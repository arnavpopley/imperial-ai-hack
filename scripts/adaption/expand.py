"""Expands the reviewed extraction seed with Adaption's Adaptive Data API (https://docs.adaptionlabs.ai).

Uploads scripts/adaption/seed-reviewed.jsonl as raw prompt/completion rows, prints the credit estimate, and only runs
the expansion when --run is passed. The expanded rows are written to scripts/adaption/expanded.jsonl.

Usage:  uv run --with adaption python scripts/adaption/expand.py --similar 150            # estimate only
        uv run --with adaption python scripts/adaption/expand.py --similar 150 --run      # spend credits
        uv run --with adaption python scripts/adaption/expand.py --resume <dataset_id>    # wait for and download a run
Each upload makes a new dataset (and so a new idempotency key), so if the script dies mid-run, resume the expansion
dataset it started instead of re-running, which would pay for a second expansion.
Needs ADAPTION_API_KEY (read from .env if present).
"""

import argparse
import os
import pathlib

from adaption import Adaption

ROOT = pathlib.Path(__file__).resolve().parents[2]
SEED = ROOT / "scripts/adaption/seed-reviewed.jsonl"
OUT = ROOT / "scripts/adaption/expanded.jsonl"


def load_env() -> None:
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


def wait(client: Adaption, dataset_id: str, what: str):
    status = client.datasets.wait_for_completion(dataset_id, timeout=3 * 3600)
    if status.status == "failed":
        message = (status.error_data and status.error_data.message) or "unknown error"
        raise RuntimeError(f"{what} failed: {message}")
    print(f"{what}: {status.status}, {status.row_count} rows")
    return status


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--similar", type=int, default=150, help="similar rows to add")
    parser.add_argument("--run", action="store_true", help="run the expansion (spends credits)")
    parser.add_argument("--resume", help="an expansion dataset id to wait for and download (spends nothing)")
    args = parser.parse_args()

    load_env()
    client = Adaption()
    if args.resume:
        wait(client, args.resume, "Expansion")
        client.datasets.download(args.resume, file_format="jsonl").write_to_file(str(OUT))
        print(f"Wrote {OUT}")
        return
    upload = client.datasets.upload_file(
        str(SEED),
        name="ModuleMatch extraction seed (reviewed)",
        processing_mode="raw",
        column_mapping={"prompt": "prompt", "completion": "completion"},
    )
    wait(client, upload.dataset_id, "Upload")

    estimate = client.datasets.augment(upload.dataset_id, similar_rows=args.similar, estimate=True)
    print(f"Estimate for {args.similar} similar rows: {estimate.estimated_credits_consumed} credits")
    if not args.run:
        print("Estimate only. Re-run with --run to expand.")
        return

    expanded = client.datasets.augment(
        upload.dataset_id,
        similar_rows=args.similar,
        idempotency_key=f"modulematch-extraction-{upload.dataset_id}-{args.similar}",
    )
    wait(client, expanded.dataset_id, "Expansion")
    client.datasets.download(expanded.dataset_id, file_format="jsonl").write_to_file(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
