# The Sixth Sense — AI/ML Urban Intelligence
**SIH 2026 | Problem Statements: PS 26124 / PS 26125**

The Sixth Sense is an AI-powered urban infrastructure monitoring engine. Designed for deployment on public transit vehicles (e.g., city buses), it utilizes edge AI to passively monitor, detect, track, and report urban issues—such as road damage—during routine transit operations.

This repository contains the complete Phase A–H engineering pipeline, from raw video ingestion to actionable, department-routed incident reports.

---

## 🛠 What the System Currently Does
- **Video Ingestion & Scheduling**: Intelligently processes video streams using configurable target framerates to optimize GPU utilization.
- **Perception Pipeline**: Leverages dual AI models for simultaneous object tracking (vehicles) and infrastructure analysis (road damage).
- **Tracking & Corroboration**: Tracks detected defects across multiple frames, consolidating flickering bounding boxes into single, high-confidence "Observations."
- **Issue Lifecycle Management**: Upgrades persistent observations into unique "Issues," routes them to relevant departments (e.g., PWD, Sanitation), and creates actionable work items.
- **UI / Command Center**: A local web dashboard that dynamically visualizes processed metrics, verified issues, and annotated video results.

---

## 🧠 AI Models & Architecture

### Models
1. **YOLO11x (`yolo11x.pt`)**
   - **Role**: General perception and vehicle detection.
   - **Status**: Fetched automatically at runtime. *(Note: This 114.6 MB file is intentionally excluded from the repository to comply with GitHub's 100 MB file-size limit. Ultralytics automatically downloads it when required).*
2. **YOLO12s RDD2022 (`models/yolo12s_RDD2022_best.pt`)**
   - **Role**: Specialized road-damage detection.
   - **Status**: A lightweight (18 MB) fine-tuned checkpoint included directly in this repository.
   - **Supported Classes**:
     - `D00`: Longitudinal Crack
     - `D10`: Transverse Crack
     - `D20`: Alligator Crack
     - `D40`: Pothole
     - `Repair`: Road Repair

### Core Architecture Pipeline
`Video Stream` → `Frame Scheduler (Quality Gating)` → `Dual Perception Inference` → `Urban Tracker (Association)` → `Observation Builder` → `Issue Manager (Corroboration)` → `Actionable Outputs (JSON/Video)`

---

## ⚙️ Requirements & Setup

Ensure you have Python 3.9+ installed and a CUDA-capable GPU (recommended) for optimal inference speed.

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/sixth_sense.git
cd sixth_sense

# 2. Install dependencies
pip install -r requirements.txt
```

---

## 🚀 Usage

### 1. Run a Real Video locally (CLI)
To run the AI pipeline on a custom dashcam video:
```bash
python run_urban_ai.py --video "your_video.mp4" --output outputs/real_video_test --profile road_damage_sensitive
```
*Note on GPS:* If executed purely via the CLI without the `--gps` flag, the pipeline behaves honestly: all detections and issues will accurately record GPS as `UNAVAILABLE` rather than fabricating locations. 

**Validation Flag:** `--process-all`
You can append the `--process-all` flag to temporarily disable performance-based frame skipping. This forces the system to run inference on every single native frame (e.g., 24 FPS) and is primarily used for strict engineering validation or debugging short video clips.

### 2. View the Command Center UI
The local Command Center provides a complete, interactive dashboard mapping the generated JSON issues and serving the annotated videos.
```bash
python serve_command_center.py
```
*Once running, open [http://127.0.0.1:8765](http://127.0.0.1:8765) in your web browser.*

---

## 🧪 Testing & Validation

The codebase includes an extensive validation suite spanning all core pipeline logic, data schemas, verification engines, and routing rules.

To run the complete test suite:
```bash
python -m pytest tests/ -v
```
**Current CI/CD Validation Result:** ✅ `122 / 122 tests passing`

### Perception Validation Success
The YOLO12s RDD2022 model and downstream logic have been successfully validated on real road footage. During validation, a real water-filled pothole within a native 24fps video stream was:
1. Positively detected by the model as `D40 / POTHOLE`.
2. Successfully observed across multiple frames and consolidated into a single POTHOLE observation.
3. Automatically elevated into a high-severity `Observation` and logged as a persistent `Issue` with bounding box metrics preserved.

---

## 📂 Repository Structure
- `/command_center/` - Frontend UI dashboard (HTML, CSS, JS).
- `/config/` - YAML definitions for pipeline profiles and routing rules.
- `/docs/` - Architecture overviews and AI validation records.
- `/models/` - Packaged AI checkpoints (e.g., `yolo12s_RDD2022_best.pt`).
- `/scripts/` - Utilities for dataset extractions and static presentation generation.
- `/sixth_sense/` - The core Python engine (Perception, Tracking, Association, Closure, Events).
- `/tests/` - Comprehensive unit and integration test suite.

---

## ⚠️ Limitations & Current Scope
- **Edge Deployment Simulation:** Currently runs on standard x86/CUDA hardware. Jetson/ARM optimization (TensorRT export) is reserved for future hardware implementation phases.
- **GPS Handling:** While the engine fully supports synchronized CSV telemetry integration, real-world continuous tracking corroboration is currently mocked using pre-recorded demo data (`data/demo_gps.csv`) when uploading via the web UI. Real deployment requires live GPS serial integration.

---

## 📚 Dataset Citations & Attribution
This project utilizes models trained on the Road Damage Dataset (RDD). We gratefully acknowledge the authors and researchers responsible for providing this open data.

- **RDD2020 Dataset:** Arya, D., Maeda, H., Ghosh, S. K., Toshniwal, D., Omata, H., Kashiyama, T., Seto, T., Mraz, A., & Sekimoto, Y. (2021), "RDD2020: An Image Dataset for Smartphone-based Road Damage Detection and Classification", Mendeley Data, V1, doi: 10.17632/5ty2wb6gvg.1
- **Transfer Learning / Multi-Country Validation:** Arya, D., Maeda, H., Ghosh, S. K., Toshniwal, D., Mraz, A., Kashiyama, T., & Sekimoto, Y. (2020). Transfer Learning-based Road Damage Detection for Multiple Countries. arXiv preprint arXiv:2008.13101.
- **Generative Adversarial Application:** Maeda, H., Kashiyama, T., Sekimoto, Y., Seto, T. and Omata, H. (2020). Generative adversarial network for road damage detection. Computer-Aided Civil and Infrastructure Engineering, 36(1), pp.47-60.
- **RDD2018 Origins:** Maeda, H., Sekimoto, Y., Seto, T., Kashiyama, T., & Omata, H. (2018). Road Damage Detection and Classification Using Deep Neural Networks with Smartphone Images. Computer-Aided Civil and Infrastructure Engineering.
