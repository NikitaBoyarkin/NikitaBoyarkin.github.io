---
title: RAG Evaluation Harness — retrieval and generation metrics
description: "A RAG pipeline with a real offline evaluation harness: recall@5 and MRR = 1.00 over 20 labeled questions, correctness 0.37. TF-IDF retrieval, runs with zero API keys; faithfulness ≡1.00 is an extractive invariant, not a measurement."
star:
  situation: "A RAG demo is easy to show and hard to measure: you cannot tell whether the retrieval or the generation is failing, or whether the result reproduces at all"
  task: "Build a pipeline with an offline eval harness that separates retrieval from generation metrics and runs without API keys"
  action: "A TF-IDF index over the concept corpus, cosine top-k, a deterministic extractive answerer; Claude plugs in behind a --llm flag and the harness stays the same"
  result: "recall@5 and MRR = 1.00 over 20 questions; correctness 0.37 for the offline baseline (faithfulness ≡1.00 is an extractive invariant); retrieval and generation scored separately"
track: analytics
hero: images/rag.svg
ogImage: /images/og/rag.png
impact:
  - "recall@5 and MRR = 1.00, precision@5 = 0.20 over 20 labeled questions"
  - "faithfulness ≡1.00 for the offline baseline — an extractive invariant (the answer is taken from the context), not a measurement; real generation scoring needs --llm"
  - "correctness 0.37 by Jaccard overlap with the gold answer; --llm lifts generation while retrieval stays fixed"
  - "Runs end-to-end with zero keys: TF-IDF + extractive fallback, reproducible"
  - "5 pytest tests over the index, search, grounding and eval summary"
tools:
  - Python
  - scikit-learn
  - pandas / NumPy
  - TF-IDF
  - pytest
  - uv
github: https://github.com/NikitaBoyarkin/rag-eval-harness
updated: 2026-10-10
date: 2026-10-10
related:
  - /projects/causal/
---

# RAG Evaluation Harness — retrieval and generation metrics

## Situation

A RAG pipeline is easy to demo on one lucky question and almost impossible to measure: you cannot tell where quality is lost — in document retrieval or in answer generation — or whether the result reproduces at all without external services. Without an offline harness, any "it got better" stays an impression, not a number.

## Task

I needed a RAG system built end-to-end, with each layer measured separately: retrieval metrics (recall@k, MRR, precision@k) over a labeled question set, and generation metrics (faithfulness, answer correctness). The harness has to run with zero API keys and stay unchanged when an LLM is plugged in.

## Actions

The corpus is 12 short analytics concept docs (A/B testing, CUPED, uplift, retention, churn, RFM, funnel, LTV, attribution, cohort, DAU/MAU, SQL window functions), chunked and TF-IDF-indexed with 1–2-grams.

- **Retrieval** — cosine top-k over the TF-IDF matrix; dependency-light and fully offline. An embeddings backend can be dropped in without touching the evaluation code.
- **Generation** — a Claude model grounded in the retrieved context if a key is set; otherwise a deterministic extractive fallback returns the most relevant sentence from the top doc. Both paths return the same `Generation` record, so evaluation is reproducible offline.
- **Evaluation** — 20 labeled questions (`data/eval.jsonl`) with gold doc ids and gold answers. Retrieval: recall@k, MRR, precision@k. Generation: faithfulness (share of answer tokens grounded in the retrieved context) and answer correctness (Jaccard overlap with the gold answer).

| Metric | Value |
|---|---|
| recall@5 | 1.00 |
| MRR | 1.00 |
| precision@5 | 0.20 |
| faithfulness (invariant, extractive) | 1.00 |
| correctness | 0.37 |

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

The value is not the numbers themselves but that the harness separates the layers. With `--llm` and an API key, generation scores rise while retrieval metrics stay put, so you can see which layer to improve. It is the same principle as an A/B test: measure first, change second.

## Limitations

Faithfulness here is a grounding proxy (answer tokens in the retrieved context), not a truth check: an answer can be grounded and still be wrong. Correctness by Jaccard is sensitive to wording — a low score is not always an error. The corpus is small (12 docs, 20 questions), so recall@5 = 1.00 is a property of this set, not a promise on real data; grow the corpus and the metric has to be recomputed.

## Documentation

- [GitHub → rag-eval-harness](https://github.com/NikitaBoyarkin/rag-eval-harness)
