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
    """Compute similarity for a single mission using combined base + weighted individual scores.

    The combined keywords produce a strong base score (60%), while individual
    keyword scores weighted by ranking position (40%) ensure that higher-ranked
    keywords proportionally influence the result.
    """
    if not keywords or not mission:
        return 0.0

    # Base score: all keywords combined (produces higher similarity)
    combined_text = " ".join(k["word"] for k in keywords)
    base_scores = get_similarity(combined_text, [mission])
    base = float(base_scores[0]) if isinstance(base_scores, list) and len(base_scores) > 0 else 0.0

    # Weighted individual scores: each keyword scored separately, weighted by rank
    total_weight = sum(k["weight"] for k in keywords)
    weighted_sum = 0.0
    for kw in keywords:
        kw_scores = get_similarity(kw["word"], [mission])
        score = float(kw_scores[0]) if isinstance(kw_scores, list) and len(kw_scores) > 0 else 0.0
        weighted_sum += kw["weight"] * score
    weighted_avg = weighted_sum / total_weight if total_weight > 0 else 0.0

    # Blend: 60% combined base + 40% weighted individual average
    return 0.60 * base + 0.40 * weighted_avg


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

    Uses 1 + N_keywords HF API calls: one for the combined keywords against
    all missions (base score), plus one per keyword for weighted individual
    scores. The 60/40 blend keeps scores high while ensuring ranking position
    proportionally affects results (e.g., rank 1 is 3x as important as rank 3).
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

        # Calls 2..N+1: each keyword individually vs all missions
        total_weight = sum(k["weight"] for k in keywords)
        weighted_sums = [0.0] * len(missions)
        for kw in keywords:
            kw_scores = get_similarity(kw["word"], missions)
            if not isinstance(kw_scores, list):
                kw_scores = [0.0] * len(missions)
            for i in range(len(missions)):
                weighted_sums[i] += kw["weight"] * float(kw_scores[i])

        # Blend: 60% combined base + 40% weighted individual average
        scores = [
            0.60 * float(base_scores[i]) + 0.40 * (weighted_sums[i] / total_weight if total_weight > 0 else 0.0)
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
