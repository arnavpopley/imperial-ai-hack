"""Prices an AutoScientist fine-tune of the extraction model WITHOUT starting one.

Uploads scripts/adaption/train.jsonl (the reviewed seed plus the validated expansion, prompt/completion rows) in
raw mode, which is the format AutoScientist trains on when a dataset has not been through Adaptive Data. Then it
calls only read-only quote and plan endpoints:
  - autoscientist.list_models: base models and their minimum row counts
  - datasets.augment(estimate=True): credits to grow the dataset to a trainable size (AutoScientist's own
    augmentation_domain_rows / augmentation_general_rows draw on the same row generation)
  - autoscientist.recommend_hyperparams: the model and plan AutoScientist would pick, "Nothing is launched"
It never calls autoscientist.create. The SDK has no credit estimate for the training run itself.

Usage:  uv run --with adaption python scripts/adaption/autoscientist-estimate.py
Writes scripts/adaption/autoscientist-estimate.json. Needs ADAPTION_API_KEY (read from .env if present).
"""

import json
import math
import os
import pathlib

from adaption import Adaption

ROOT = pathlib.Path(__file__).resolve().parents[2]
TRAIN = ROOT / "scripts/adaption/train.jsonl"
OUT = ROOT / "scripts/adaption/autoscientist-estimate.json"
# Small models need 1,000 rows (docs: AutoScientist supported models); the runbook recommends 20,000 domain rows
# with 40% general rows to keep general capability.
MIN_ROWS = 1_000
RUNBOOK_DOMAIN = 20_000
GENERAL_RATIO = 0.4


def load_env() -> None:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


def dump(obj):
    return obj.model_dump(mode="json") if hasattr(obj, "model_dump") else obj


def main() -> None:
    load_env()
    client = Adaption()
    rows = sum(1 for line in TRAIN.read_text().splitlines() if line.strip())

    upload = client.datasets.upload_file(
        str(TRAIN),
        name=f"ModuleMatch extraction train ({rows} rows, reviewed seed + validated expansion)",
        processing_mode="raw",
        column_mapping={"prompt": "prompt", "completion": "completion"},
    )
    status = client.datasets.wait_for_completion(upload.dataset_id, timeout=1800)
    if status.status == "failed":
        raise RuntimeError(f"upload failed: {status.error_data}")
    print(f"Uploaded {upload.dataset_id}: {status.status}, {status.row_count} rows")

    models = client.autoscientist.list_models()
    result = {"dataset_id": upload.dataset_id, "rows": status.row_count, "models": dump(models)["models"], "plans": []}

    plans = {
        "minimum (1,000 rows, no general rows)": (max(0, MIN_ROWS - rows), 0),
        "runbook (20,000 domain rows, 40% general)": (
            max(0, RUNBOOK_DOMAIN - rows),
            math.ceil(GENERAL_RATIO * RUNBOOK_DOMAIN / (1 - GENERAL_RATIO)),
        ),
    }
    quote = client.datasets.augment(upload.dataset_id, estimate=True)
    result["recommended_fill_quote"] = dump(quote)
    print(f"Recommended fill quote: {dump(quote)}")
    for name, (domain, general) in plans.items():
        estimate = client.datasets.augment(upload.dataset_id, domain_rows=domain, general_rows=general, estimate=True)
        plan = client.autoscientist.recommend_hyperparams(
            dataset_id=upload.dataset_id, augmentation_domain_rows=domain, augmentation_general_rows=general
        )
        entry = {
            "plan": name,
            "domain_rows_to_add": domain,
            "general_rows_to_add": general,
            "augmentation_estimate": dump(estimate),
            "recommended": dump(plan),
        }
        result["plans"].append(entry)
        print(f"{name}: +{domain} domain, +{general} general -> {estimate.estimated_credits_consumed} credits; "
              f"model {plan.model}, hyperparams {dump(plan.hyperparams)}")

    OUT.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
