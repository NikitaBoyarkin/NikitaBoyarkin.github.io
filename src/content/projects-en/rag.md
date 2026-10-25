---
title: RAG Evaluation Harness — retrieval and generation metrics
description: "RAG pipeline with an offline harness: recall@5 and MRR = 1.00 on 20 questions, correctness 0.37, 0.00 on retrieval-miss control set. TF-IDF, no API keys; faithfulness ≡1.00 — an extractive invariant."
star:
  situation: "A RAG demo is easy to show and hard to measure: you cannot tell whether the retrieval or the generation is failing, or whether the result reproduces at all"
  task: "Build a pipeline with an offline eval harness that separates retrieval from generation metrics and runs without API keys"
  action: "A TF-IDF index over the concept corpus, cosine top-k, a deterministic extractive answerer; Claude plugs in behind a --llm flag and the harness stays the same"
  result: "recall@5 and MRR = 1.00 over 20 questions and 0.00 on an 11-question control set of retrieval misses (MRR@all 0.12) — the metric can fall; correctness 0.37 for the offline baseline (faithfulness ≡1.00 is an extractive invariant); retrieval and generation scored separately"
track: analytics
hero: images/rag.svg
ogImage: /images/og/rag.png
impact:
  - "recall@5 and MRR = 1.00, precision@5 = 0.20 over 20 labeled questions"
  - "An 11-question negative control: the gold doc is verified outside the top 5 (ranks 6–12), where the same metrics read 0.00 and MRR@all 0.12 — the depth of the miss survives"
  - "faithfulness ≡1.00 for the offline baseline — an extractive invariant (the answer is taken from the context), not a measurement; real generation scoring needs --llm"
  - "correctness 0.37 by Jaccard overlap with the gold answer; --llm lifts generation while retrieval stays fixed"
  - "Runs end-to-end with zero keys: TF-IDF + extractive fallback, reproducible"
  - "10 pytest tests: index, search, grounding, eval summary, and four binding the control set's discriminating power"
tools:
  - Python
  - scikit-learn
  - pandas / NumPy
  - TF-IDF
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/rag-eval-harness
updated: 2026-10-17
date: 2026-10-10
demo: demos/rag/index.html
related:
  - /projects/causal/
---

# RAG Evaluation Harness — retrieval and generation metrics

**▶ [Data-flow diagram](/diagrams/rag-eval-harness.html)** — self-contained HTML, opens in a browser — no install, no build

## Situation

A RAG pipeline is easy to demo on one lucky question and almost impossible to measure: you cannot tell where quality is lost — in document retrieval or in answer generation — or whether the result reproduces at all without external services. Without an offline harness, any "it got better" stays an impression, not a number.

## Task

I needed a RAG system built end-to-end, with each layer measured separately: retrieval metrics (recall@k, MRR, precision@k) over a labeled question set, and generation metrics (faithfulness, answer correctness). The harness has to run with zero API keys and stay unchanged when an LLM is plugged in.

## Actions

The corpus is 12 short analytics concept docs (A/B testing, CUPED, uplift, retention, churn, RFM, funnel, LTV, attribution, cohort, DAU/MAU, SQL window functions), chunked and TF-IDF-indexed with 1–2-grams.

- **Retrieval** — cosine top-k over the TF-IDF matrix; dependency-light and fully offline. An embeddings backend can be dropped in without touching the evaluation code.
- **Generation** — a Claude model grounded in the retrieved context if a key is set; otherwise a deterministic extractive fallback returns the most relevant sentence from the top doc. Both paths return the same `Generation` record, so evaluation is reproducible offline.
- **Evaluation** — 20 labeled questions (`data/eval.jsonl`) with gold doc ids and gold answers, plus an 11-question negative control (`data/eval_hard.jsonl`) whose gold doc sits outside the top 5. Retrieval: recall@k, MRR, MRR@all, precision@k. Generation: faithfulness (share of answer tokens grounded in the retrieved context) and answer correctness (Jaccard overlap with the gold answer).

| Metric | Easy (20 questions) | Control (11 questions) |
|---|---|---|
| recall@5 | 1.00 | 0.00 |
| MRR | 1.00 | 0.00 |
| MRR@all (full ranking) | 1.00 | 0.12 |
| precision@5 | 0.20 | 0.00 |
| faithfulness (invariant, extractive) | 1.00 | 1.00 |
| correctness | 0.37 | 0.07 |

Both blocks run the same metric code at the same k; only the questions differ.

### Run

```bash
uv run --with scikit-learn --with pandas --with numpy python run.py query "How is the CUPED theta coefficient computed?"
uv run --with scikit-learn --with pandas --with numpy python run.py eval
# with a real LLM (requires ANTHROPIC_API_KEY):
uv run --with scikit-learn --with pandas --with numpy --with anthropic python run.py eval --llm
uv run --with scikit-learn --with pandas --with numpy --with pytest pytest -q
```

Per-question breakdown: `reports/retrieval_per_question.csv`, `reports/generation_per_question.csv`.

## Result

Retrieval is perfect on this corpus: recall@5 and MRR = 1.00, the gold doc ranks 1 for all 20 questions — TF-IDF is enough at this scale and topic separation. The offline extractive baseline is grounded by construction — faithfulness ≡1.00 because the answer is taken from the context — and reaches 0.37 correctness by token overlap.

But 1.00 on its own proves nothing: on a saturated set the metric cannot fall, and "the harness measures" stays a claim. So there is a second, control set: 11 questions reworded without their gold doc's vocabulary. Every candidate was run through the live retriever and kept only if the gold doc genuinely landed outside the top 5 — at ranks 6–12. On the control set the same metrics read recall@5 = 0.00, while MRR@all (reciprocal rank over the full ranking, not truncated at k) reads 0.12 against 1.00: the metric separates a rank-6 near-miss from a rank-12 miss. Tellingly, faithfulness stays 1.00 on the control set too — the extractive answer is still a verbatim substring, now of the wrong document. So faithfulness cannot see a retrieval failure; only correctness notices (0.37 → 0.07).

The value is not the numbers themselves but that the harness separates the layers. With `--llm` and an API key, generation scores rise while retrieval metrics stay put, so you can see which layer to improve. It is the same principle as an A/B test: measure first, change second.

## Limitations

Faithfulness here is a grounding proxy (answer tokens in the retrieved context), not a truth check: an answer can be grounded and still be wrong. Correctness by Jaccard is sensitive to wording — a low score is not always an error. The corpus is small (12 docs), so recall@5 = 1.00 on the easy set is a property of this set, not a promise on real data; the control set shows the metric can fall, but it does not replace a measurement on a real corpus — grow the corpus and everything has to be recomputed. With 12 docs and one gold per question, recall@5 and precision@5 are binary inside the window (a miss is 0.00, no partial credit), so the depth of a miss only shows in MRR@all and the gold ranks.

## Documentation

- [GitHub → rag-eval-harness](https://github.com/NikitaBoyarkin/rag-eval-harness)
