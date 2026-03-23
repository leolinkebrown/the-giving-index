# NLP similarity backend for The Giving Index
# Uses Hugging Face Inference API with sentence-transformers model
# to compute semantic similarity between user keywords and charity missions

import os
import requests
from flask import Flask, request as flask_request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Hugging Face Inference API configuration
HF_API_TOKEN = os.environ.get("charity_token", "")
HF_MODEL_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2"


def get_similarity(source_sentence, sentences):
    """Get similarity scores from HF sentence-similarity pipeline."""
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    response = requests.post(HF_MODEL_URL, headers=headers, json={
        "inputs": {
            "source_sentence": source_sentence,
            "sentences": sentences
        },
        "options": {"wait_for_model": True}
    })
    response.raise_for_status()
    return response.json()


@app.route("/similarity", methods=["POST"])
def similarity():
    """Calculate semantic similarity between user keywords and a charity mission."""
    data = flask_request.get_json()

    keywords = data.get("keywords", [])
    mission = data.get("mission", "")

    if not keywords or not mission:
        return jsonify({"similarity": 0.0})

    # Combine keywords into a single text
    keyword_text = " ".join(keywords)

    try:
        # HF sentence-similarity returns an array of scores
        scores = get_similarity(keyword_text, [mission])
        score = scores[0] if isinstance(scores, list) and len(scores) > 0 else 0.0
        return jsonify({"similarity": float(score)})
    except Exception as e:
        print(f"HF API error: {e}")
        return jsonify({"similarity": 0.0})


@app.route("/", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/debug", methods=["GET"])
def debug():
    """Debug endpoint to test HF API connection."""
    token_preview = HF_API_TOKEN[:8] + "..." if len(HF_API_TOKEN) > 8 else "(empty)"
    try:
        scores = get_similarity("education children", ["Providing education to underprivileged children"])
        return jsonify({
            "token_preview": token_preview,
            "test_score": scores,
            "status": "working"
        })
    except Exception as e:
        return jsonify({
            "token_preview": token_preview,
            "error": str(e)
        })


if __name__ == "__main__":
    # Use PORT env var for Render; default to 5000 for local development
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
