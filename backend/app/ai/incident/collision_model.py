"""
Temporal Collision Detection Model for The Sixth Sense AI.

Architecture:
- Spatial Backbone: ResNet18 (pretrained ImageNet) feature extractor.
- Temporal Aggregator: 2-layer Bidirectional GRU.
- Temporal Attention Pooling: Dynamically weights frames to identify collision timestamp.
- Classification Head: Multi-layer perceptron with dropout producing collision candidate logits.

Outputs:
- video_logit / video_prob: Overall video-level collision probability.
- temporal_attention: Frame-level attention distribution over time.
- frame_scores: Frame-level collision score proxy.
"""

from typing import Dict, Optional, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models


class TemporalAttention(nn.Module):
    """Self-attention pooling over time steps."""

    def __init__(self, feature_dim: int, hidden_dim: int = 64):
        super().__init__()
        self.attn = nn.Sequential(
            nn.Linear(feature_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 1),
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: Tensor of shape (B, T, feature_dim)
        Returns:
            pooled: Tensor of shape (B, feature_dim)
            weights: Tensor of shape (B, T, 1)
        """
        scores = self.attn(x)  # (B, T, 1)
        weights = F.softmax(scores, dim=1)  # (B, T, 1)
        pooled = torch.sum(x * weights, dim=1)  # (B, feature_dim)
        return pooled, weights


class CollisionDetector(nn.Module):
    """
    Spatio-temporal neural network for video-level and frame-level collision candidate detection.
    """

    def __init__(
        self,
        num_frames: int = 16,
        hidden_dim: int = 128,
        num_gru_layers: int = 2,
        dropout: float = 0.3,
        freeze_backbone_early: bool = True,
    ):
        super().__init__()
        self.num_frames = num_frames

        # ResNet18 backbone
        backbone = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        # Retain convolutional layers up to avgpool
        self.conv1 = backbone.conv1
        self.bn1 = backbone.bn1
        self.relu = backbone.relu
        self.maxpool = backbone.maxpool
        self.layer1 = backbone.layer1
        self.layer2 = backbone.layer2
        self.layer3 = backbone.layer3
        self.layer4 = backbone.layer4
        self.avgpool = backbone.avgpool

        if freeze_backbone_early:
            # Freeze layers 1-3 to prevent overfitting on small video dataset
            for module in [self.conv1, self.bn1, self.layer1, self.layer2, self.layer3]:
                for param in module.parameters():
                    param.requires_grad = False

        backbone_dim = 512

        # BiGRU Temporal Aggregator
        self.gru = nn.GRU(
            input_size=backbone_dim,
            hidden_size=hidden_dim,
            num_layers=num_gru_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_gru_layers > 1 else 0.0,
        )
        gru_out_dim = hidden_dim * 2

        # Attention pooling
        self.attention = TemporalAttention(gru_out_dim, hidden_dim=64)

        # Classifier head
        self.classifier = nn.Sequential(
            nn.Linear(gru_out_dim, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

        # Frame-level projection for temporal localization
        self.frame_head = nn.Linear(gru_out_dim, 1)

    def extract_spatial_features(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (B * T, 3, H, W)
        Returns:
            features: (B * T, 512)
        """
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)
        x = self.avgpool(x)
        return torch.flatten(x, 1)

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Args:
            x: Tensor of shape (B, T, 3, H, W) normalized with ImageNet stats.
        Returns:
            Dict containing:
                - logit: (B, 1)
                - prob: (B, 1)
                - attn_weights: (B, T, 1)
                - frame_probs: (B, T, 1)
        """
        B, T, C, H, W = x.shape
        x_flat = x.view(B * T, C, H, W)
        spatial_feats = self.extract_spatial_features(x_flat)  # (B * T, 512)
        spatial_feats = spatial_feats.view(B, T, -1)  # (B, T, 512)

        gru_out, _ = self.gru(spatial_feats)  # (B, T, gru_out_dim)
        pooled, attn_weights = self.attention(gru_out)  # (B, gru_out_dim), (B, T, 1)

        logit = self.classifier(pooled)  # (B, 1)
        prob = torch.sigmoid(logit)  # (B, 1)

        frame_logits = self.frame_head(gru_out)  # (B, T, 1)
        frame_probs = torch.sigmoid(frame_logits)

        return {
            "logit": logit,
            "prob": prob,
            "attn_weights": attn_weights,
            "frame_probs": frame_probs,
        }

    def save_checkpoint(self, path: str, extra_meta: Optional[Dict] = None):
        """Save model checkpoint with configuration."""
        checkpoint = {
            "state_dict": self.state_dict(),
            "config": {
                "num_frames": self.num_frames,
            },
            "meta": extra_meta or {},
        }
        torch.save(checkpoint, path)

    @classmethod
    def load_checkpoint(cls, path: str, device: str = "cpu") -> "CollisionDetector":
        """Load model from saved checkpoint."""
        checkpoint = torch.load(path, map_location=device, weights_only=False)
        cfg = checkpoint.get("config", {})
        model = cls(num_frames=cfg.get("num_frames", 16))
        model.load_state_dict(checkpoint["state_dict"])
        model.to(device)
        model.eval()
        return model
