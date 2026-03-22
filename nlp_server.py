# NLP similarity backend for The Giving Index
# Uses TF-IDF vectorization and cosine similarity to match
# user keywords against charity mission statements

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app)


@app.route("/similarity", methods=["POST"])
def similarity():
    """Calculate cosine similarity between user keywords and a charity mission."""
    data = request.get_json()

    keywords = data.get("keywords", [])
    mission = data.get("mission", "")

    if not keywords or not mission:
        return jsonify({"similarity": 0.0})

    # Combine keywords into a single text for comparison
    keyword_text = " ".join(keywords)

    # Vectorize both texts using TF-IDF and compute cosine similarity
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform([keyword_text, mission])
    score = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

    return jsonify({"similarity": float(score)})


@app.route("/", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    # Use PORT env var for Render; default to 5000 for local development
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
