

from flask import Flask, request, jsonify
from flask_cors import CORS
from pipeline import run_research_pipeline

app = Flask(__name__)
CORS(app)  # Allow React dev server (localhost:5173) to call this


@app.route("/run", methods=["POST"])
def run():
    data = request.get_json()
    topic = data.get("topic", "").strip()

    if not topic:
        return jsonify({"error": "Topic is required"}), 400

    try:
        state = run_research_pipeline(topic)

        # Ensure all values are strings for the frontend
        return jsonify({
            "search_results":  str(state.get("search_results", "")),
            "scraped_content": str(state.get("scraped_content", "")),
            "report":          str(state.get("report", "")),
            "feedback":        str(state.get("feedback", "")),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(port=5000, debug=True)
