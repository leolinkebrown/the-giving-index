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


def weighted_similarity_single(keywords, mission):
    """Compute similarity for a single mission using combined + ranking boost.

    Scores the combined keywords against the mission for a strong base score,
    then adds a boost from the top-ranked keyword so ranking affects results.
    """
    if not keywords or not mission:
        return 0.0

    # Base score: all keywords combined (produces higher similarity)
    combined_text = " ".join(k["word"] for k in keywords)
    base_scores = get_similarity(combined_text, [mission])
    base = float(base_scores[0]) if isinstance(base_scores, list) and len(base_scores) > 0 else 0.0

    # Ranking boost: score the top-ranked keyword individually
    top_kw = max(keywords, key=lambda k: k["weight"])
    top_scores = get_similarity(top_kw["word"], [mission])
    top = float(top_scores[0]) if isinstance(top_scores, list) and len(top_scores) > 0 else 0.0

    # Blend: 75% combined base + 25% top keyword boost
    return 0.75 * base + 0.25 * top


@app.route("/similarity", methods=["POST"])
def similarity():
    """Calculate semantic similarity between user keywords and a charity mission."""
    data = flask_request.get_json()

    keywords = data.get("keywords", [])
    mission = data.get("mission", "")

    if not keywords or not mission:
        return jsonify({"similarity": 0.0})

    try:
        # Support both old format (string array) and new format (object array)
        if isinstance(keywords[0], str):
            keyword_text = " ".join(keywords)
            scores = get_similarity(keyword_text, [mission])
            score = scores[0] if isinstance(scores, list) and len(scores) > 0 else 0.0
            return jsonify({"similarity": float(score)})
        else:
            score = weighted_similarity_single(keywords, mission)
            return jsonify({"similarity": score})
    except Exception as e:
        print(f"HF API error: {e}")
        return jsonify({"similarity": 0.0})


@app.route("/batch-similarity", methods=["POST"])
def batch_similarity():
    """Calculate weighted similarity for multiple missions in one request.

    Uses only 2 HF API calls total: one for the combined keywords against
    all missions, and one for the top-ranked keyword against all missions.
    The scores are blended so ranking position affects results.
    """
    data = flask_request.get_json()

    keywords = data.get("keywords", [])
    missions = data.get("missions", [])

    if not keywords or not missions:
        return jsonify({"scores": [0.0] * len(missions)})

    try:
        # Call 1: combined keywords vs all missions (strong base scores)
        combined_text = " ".join(k["word"] for k in keywords)
        base_scores = get_similarity(combined_text, missions)
        if not isinstance(base_scores, list):
            base_scores = [0.0] * len(missions)

        # Call 2: top-ranked keyword vs all missions (ranking boost)
        top_kw = max(keywords, key=lambda k: k["weight"])
        top_scores = get_similarity(top_kw["word"], missions)
        if not isinstance(top_scores, list):
            top_scores = [0.0] * len(missions)

        # Blend: 75% combined base + 25% top keyword boost
        scores = [
            0.75 * float(base_scores[i]) + 0.25 * float(top_scores[i])
            for i in range(len(missions))
        ]
        return jsonify({"scores": scores})
    except Exception as e:
        print(f"HF API error: {e}")
        return jsonify({"scores": [0.0] * len(missions)})


@app.route("/", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    # Use PORT env var for Render; default to 5000 for local development
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
