"""
GPU Context — The Sixth Sense
Verify CUDA availability, select device, print startup banner, provide warmup.
Never silently falls back to CPU — raises explicitly if GPU is required but unavailable.
"""
from __future__ import annotations
import sys
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def verify_cuda(require_gpu: bool = False) -> "torch.device":
    """
    Verify CUDA/GPU availability and return the compute device.


    Args:
        require_gpu: If True, raise RuntimeError when GPU is unavailable.

    Returns:
        torch.device — 'cuda:0' or 'cpu'
    """
    try:
        import torch
    except ImportError:
        raise ImportError("PyTorch is not installed. Run: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")

    cuda_available = torch.cuda.is_available()
    device = torch.device("cuda:0") if cuda_available else torch.device("cpu")

    if not cuda_available and require_gpu:
        raise RuntimeError(
            "GPU required but CUDA is not available. "
            "Check driver installation and PyTorch CUDA build."
        )

    return device


def print_startup_banner(
    model_names: list[str],
    device: "torch.device",
    input_resolution: tuple[int, int],
    target_fps: int,
    profile: str,
) -> None:
    """Print the mandatory startup diagnostic banner."""
    try:
        import torch
        torch_ver = torch.__version__
        cuda_ver = torch.version.cuda if torch.cuda.is_available() else "N/A"
        gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "None"
        vram_total = (
            torch.cuda.get_device_properties(0).total_memory / 1024**3
            if torch.cuda.is_available()
            else 0
        )
    except Exception:
        torch_ver = "unknown"
        cuda_ver = "N/A"
        gpu_name = "None"
        vram_total = 0

    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║          THE SIXTH SENSE — AI/ML ENGINE STARTUP              ║
║          SIH 2026 | PS 26124/26125                           ║
╠══════════════════════════════════════════════════════════════╣
║  GPU          : {gpu_name:<44} ║
║  CUDA         : {cuda_ver:<44} ║
║  PyTorch      : {torch_ver:<44} ║
║  Device       : {str(device):<44} ║
║  VRAM         : {f'{vram_total:.1f} GB' if vram_total else 'N/A':<44} ║
╠══════════════════════════════════════════════════════════════╣
║  Profile      : {profile:<44} ║
║  Models       : {', '.join(model_names):<44} ║
║  Resolution   : {f'{input_resolution[0]}x{input_resolution[1]}':<44} ║
║  Target FPS   : {str(target_fps):<44} ║
╚══════════════════════════════════════════════════════════════╝"""
    print(banner)
    logger.info("Startup banner printed. Device=%s GPU=%s CUDA=%s", device, gpu_name, cuda_ver)


def warmup_model(model, device: "torch.device", imgsz: int = 640, n_iters: int = 3) -> float:
    """
    Run N dummy inference passes to warm up the model and JIT/CUDA cache.

    Returns:
        Average warmup inference time in ms.
    """
    import numpy as np
    dummy = np.zeros((imgsz, imgsz, 3), dtype=np.uint8)
    times = []
    for _ in range(n_iters):
        t0 = time.perf_counter()
        model(dummy, verbose=False)
        times.append((time.perf_counter() - t0) * 1000)
    avg_ms = sum(times) / len(times)
    logger.info("Model warmup complete: avg %.1f ms over %d runs", avg_ms, n_iters)
    return avg_ms


def get_gpu_memory_mb() -> Optional[float]:
    """Return current GPU memory allocated in MB, or None if unavailable."""
    try:
        import torch
        if torch.cuda.is_available():
            return torch.cuda.memory_allocated(0) / 1024**2
    except Exception:
        pass
    return None


def get_gpu_memory_reserved_mb() -> Optional[float]:
    """Return GPU memory reserved (cached) in MB, or None."""
    try:
        import torch
        if torch.cuda.is_available():
            return torch.cuda.memory_reserved(0) / 1024**2
    except Exception:
        pass
    return None
