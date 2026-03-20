# NLP similarity backend for The Giving Index
# Encodes user keywords and charity missions using sentence-transformers
# and returns cosine similarity scores

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer, util

app = Flask(__name__)
CORS(app)

# Load the sentence transformer model (runs once at startup)
model = SentenceTransformer("all-MiniLM-L6-v2")


@app.route("/similarity", methods=["POST"])
def similarity():
    """Calculate cosine similarity between user keywords and a charity mission."""
    data = request.get_json()

    keywords = data.get("keywords", [])
    mission = data.get("mission", "")

    if not keywords or not mission:
        return jsonify({"similarity": 0.0})

    # Combine keywords into a single text for encoding
    keyword_text = " ".join(keywords)

    keyword_embedding = model.encode(keyword_text, convert_to_tensor=True)
    mission_embedding = model.encode(mission, convert_to_tensor=True)

    score = util.cos_sim(keyword_embedding, mission_embedding).item()

    return jsonify({"similarity": float(score)})


if __name__ == "__main__":
    # Use PORT env var for Render; default to 5000 for local development
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
