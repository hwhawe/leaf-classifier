"""
Backend API — Klasifikasi Penyakit Daun (ViT-Small/16)

Menjalankan model .pth hasil training di Colab, menerima gambar daun dari
frontend React, dan mengembalikan prediksi kelas + confidence.

Jalankan:
    pip install -r requirements.txt
    python app.py
Server akan aktif di http://localhost:5000
"""

import io
import json
import os

import timm
import torch
import torch.nn.functional as F
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image
from torchvision import transforms

# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------
MODEL_PATH = os.environ.get("MODEL_PATH", "vit_small_olid_best.pth")
CLASS_NAMES_PATH = os.environ.get("CLASS_NAMES_PATH", "class_names.json")
IMG_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# ---------------------------------------------------------------------------
# Load nama kelas
# ---------------------------------------------------------------------------
if not os.path.exists(CLASS_NAMES_PATH):
    raise FileNotFoundError(
        f"'{CLASS_NAMES_PATH}' tidak ditemukan. Buat file ini berisi list nama kelas "
        "sesuai urutan label_id dari training (lihat CLASS_NAMES di notebook Colab), "
        'contoh: ["Apple___Apple_scab", "Apple___Black_rot", ...]'
    )

with open(CLASS_NAMES_PATH, "r") as f:
    CLASS_NAMES = json.load(f)

NUM_CLASSES = len(CLASS_NAMES)

# ---------------------------------------------------------------------------
# Load model
# ---------------------------------------------------------------------------
print(f"Loading model dari {MODEL_PATH} ({NUM_CLASSES} kelas) ke {DEVICE}...")
model = timm.create_model("vit_small_patch16_224", pretrained=False, num_classes=NUM_CLASSES)
state_dict = torch.load(MODEL_PATH, map_location=DEVICE)
model.load_state_dict(state_dict)
model.to(DEVICE)
model.eval()
print("Model siap.")

transform = transforms.Compose(
    [
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
)

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)  # izinkan request dari frontend React (origin berbeda saat dev)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "webp"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "device": str(DEVICE), "num_classes": NUM_CLASSES})


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "Tidak ada file 'image' pada request."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Nama file kosong."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Format file tidak didukung."}), 400

    try:
        img_bytes = file.read()
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception:
        return jsonify({"error": "Gagal membaca gambar."}), 400

    input_tensor = transform(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model(input_tensor)
        probs = F.softmax(outputs, dim=1)[0]

    top5_prob, top5_idx = torch.topk(probs, k=min(5, NUM_CLASSES))

    predictions = [
        {"label": CLASS_NAMES[idx.item()], "confidence": round(prob.item() * 100, 2)}
        for prob, idx in zip(top5_prob, top5_idx)
    ]

    return jsonify(
        {
            "prediction": predictions[0]["label"],
            "confidence": predictions[0]["confidence"],
            "top5": predictions,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
