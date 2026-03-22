# NLP similarity backend for The Giving Index
# Uses Hugging Face Inference API to encode text with all-MiniLM-L6-v2
# and computes cosine similarity between user keywords and charity missions

import os
import requests
import numpy as np
from flask import Flask, request as flask_request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Hugging Face Inference API configuration
HF_API_TOKEN = os.environ.get("HF_API_TOKEN", "")
HF_MODEL_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"


def get_embedding(text):
    """Get sentence embedding from Hugging Face Inference API."""
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    response = requests.post(HF_MODEL_URL, headers=headers, json={"inputs": text})
    response.raise_for_status()
    return np.array(response.json())


def cosine_sim(a, b):
    """Compute cosine similarity between two vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


@app.route("/similarity", methods=["POST"])
def similarity():
    """Calculate semantic similarity between user keywords and a charity mission."""
    data = flask_request.get_json()

    keywords = data.get("keywords", [])
    mission = data.get("mission", "")

    if not keywords or not mission:
        return jsonify({"similarity": 0.0})

    # Combine keywords into a single text for encoding
    keyword_text = " ".join(keywords)

    try:
        keyword_embedding = get_embedding(keyword_text)
        mission_embedding = get_embedding(mission)
        score = cosine_sim(keyword_embedding, mission_embedding)
        return jsonify({"similarity": score})
    except Exception as e:
        print(f"HF API error: {e}")
        return jsonify({"similarity": 0.0})


@app.route("/", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    # Use PORT env var for Render; default to 5000 for local development
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
