"""Gemini client: write the prose fields, and only the prose fields.

Responsibility
--------------
Fill exactly three things, using already-computed structure as input:

  * `findings[].explanation` — what / why_it_matters / fix / confidence
  * `attack_paths[].title` and `.narrative`
  * `risk.summary`

The LLM never ranks, never scores, never reorders, and never invents a number the
scorer did not produce. If a call fails, leave the field null and append to
ScanResult.errors — the dashboard renders fine without prose.

Pinned usage (do not substitute the old package):

    from google import genai
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

Model: Gemini 2.0 Flash. Always use structured-JSON output mode with an explicit
response schema. Never regex-strip ``` fences off a text response.

Definition of done
------------------
Every reported finding has a non-null `explanation` after this stage on a live run.
"""
