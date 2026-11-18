"""Evaluate a labeled held-out directory through the real HTTP inference API.

No training; writes provenance, per-image probabilities, metrics and timings.
Usage: python evaluate.py --dataset PATH --url http://127.0.0.1:8001 --output PATH
"""
import argparse
import csv
import hashlib
import json
import statistics
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
import os
from model_spec import CLASS_SLUGS, MODEL_SHA256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--url', default='http://127.0.0.1:8001')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    load_dotenv(Path(__file__).parent / '.env')
    headers = {'X-AI-API-Key': os.getenv('AI_API_KEY', '')}
    def request(path, data=None, mime=None):
        req = urllib.request.Request(args.url + path, data=data, headers={**headers, **({'Content-Type': mime} if mime else {})})
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.load(response)
    health = request('/health')
    assert health['version'] == MODEL_SHA256 and health['classNames'] == CLASS_SLUGS
    manifest = args.dataset / 'reports/manifest.csv'
    with manifest.open(encoding='utf-8-sig', newline='') as f:
        source = list(csv.DictReader(f))
    selected = [r for r in source if r['split'] == 'test' and r['label'] in CLASS_SLUGS]
    assert len(selected) == 751, 'Unexpected held-out set size; inspect provenance before evaluation'
    train_hashes = {r['output_sha256'] for r in source if r['split'] == 'train'}
    train_groups = {r['group_id'] for r in source if r['split'] == 'train'}
    rows = []; cm = [[0] * 4 for _ in range(4)]
    for row in selected:
        path = args.dataset / row['relative_path']
        data = path.read_bytes(); digest = hashlib.sha256(data).hexdigest()
        assert digest == row['output_sha256'] and digest not in train_hashes
        assert row['group_id'] not in train_groups
        mime = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}[path.suffix.lower()]
        started = time.perf_counter(); result = request('/predict', data, mime); elapsed = (time.perf_counter() - started) * 1000
        p = result['prediction']; truth = CLASS_SLUGS.index(row['label'])
        assert result['model']['version'] == MODEL_SHA256
        cm[truth][p['classIndex']] += 1
        rows.append({'relative_path': row['relative_path'], 'label': row['label'], 'sha256': digest,
                     'predicted': p['className'], 'confidence': p['confidence'], 'elapsedMs': elapsed,
                     'probabilities': p['probabilities']})
        if len(rows) % 100 == 0:
            print(f'Evaluated {len(rows)}/{len(selected)}', flush=True)
    precisions = []; recalls = []; f1s = []
    for i in range(4):
        tp = cm[i][i]; actual = sum(cm[i]); predicted = sum(r[i] for r in cm)
        precision = tp / predicted if predicted else 0; recall = tp / actual if actual else 0
        precisions.append(precision); recalls.append(recall)
        f1s.append(2 * precision * recall / (precision + recall) if precision + recall else 0)
    report = {'testedAtUtc': datetime.now(timezone.utc).isoformat(), 'health': health, 'images': len(rows),
              'dataset': str(args.dataset.resolve()), 'manifestSha256': hashlib.sha256(manifest.read_bytes()).hexdigest(),
              'exactTrainOverlap': 0, 'manifestTrainGroupOverlap': 0,
              'accuracy': sum(cm[i][i] for i in range(4)) / len(rows),
              'macroPrecision': statistics.mean(precisions), 'macroRecall': statistics.mean(recalls), 'macroF1': statistics.mean(f1s),
              'confusionMatrix': cm, 'classOrder': CLASS_SLUGS, 'classPrecision': precisions, 'classRecall': recalls,
              'httpMeanMs': statistics.mean(r['elapsedMs'] for r in rows),
              'httpMedianMs': statistics.median(r['elapsedMs'] for r in rows), 'rows': rows,
              'limitations': 'Local manifest provenance, not independently verified Colab experiment split; near-duplicate/biological independence not guaranteed. HTTP timing covers local AI API, excludes browser/backend/database.'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in {'rows', 'health'}}, ensure_ascii=True))


if __name__ == '__main__':
    main()
