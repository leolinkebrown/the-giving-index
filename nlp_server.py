from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer, util

app = Flask(__name__)
CORS(app)  

model = SentenceTransformer("all-MiniLM-L6-v2")

@app.route("/similarity", methods=["POST"])
def similarity():
    data = request.get_json()

    keywords = data.get("keywords", [])
    mission = data.get("mission", "")

    if not keywords or not mission:
        return jsonify({ "similarity": 0.0 })

    keyword_text = " ".join(keywords)

    keyword_embedding = model.encode(keyword_text, convert_to_tensor=True)
    mission_embedding = model.encode(mission, convert_to_tensor=True)

    score = util.cos_sim(keyword_embedding, mission_embedding).item()

    return jsonify({ "similarity": float(score) })

if __name__ == "__main__":
    app.run(debug=True)
