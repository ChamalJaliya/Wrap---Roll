#!/usr/bin/env python3
"""Compute PayHere webhook md5sig to match PaymentService.processWebhook (API)."""
from __future__ import annotations

import argparse
import base64
import hashlib
import os
import re
import sys


def resolve_payhere_merchant_secret(raw: str) -> str:
    s = raw.strip().replace("\ufeff", "").strip("\"'")
    if not re.fullmatch(r"[A-Za-z0-9+/]+=*", s) or len(s) < 12:
        return s
    try:
        decoded = base64.b64decode(s).decode("utf8").strip()
        if re.fullmatch(r"\d{10,}", decoded):
            return decoded
    except Exception:
        pass
    return s


def main() -> None:
    p = argparse.ArgumentParser(description="PayHere webhook signature (server-compatible).")
    p.add_argument("--merchant-id", default=os.environ.get("PAYHERE_MERCHANT_ID", "").strip())
    p.add_argument("--secret", default=os.environ.get("PAYHERE_MERCHANT_SECRET", ""))
    p.add_argument("--order-id", required=True)
    p.add_argument(
        "--amount",
        required=True,
        help="Exact payhere_amount string in body & hash (e.g. 828 from API total field).",
    )
    p.add_argument("--currency", default="LKR")
    p.add_argument("--status-code", default="2")
    args = p.parse_args()
    if not args.merchant_id or not args.secret:
        print("Need PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET", file=sys.stderr)
        sys.exit(2)
    secret = resolve_payhere_merchant_secret(args.secret)
    secret_hash = hashlib.md5(secret.encode("utf8")).hexdigest().upper()
    cur = args.currency.strip().upper()
    raw = (
        args.merchant_id
        + args.order_id
        + args.amount
        + cur
        + args.status_code
        + secret_hash
    )
    print(hashlib.md5(raw.encode("utf8")).hexdigest().upper())


if __name__ == "__main__":
    main()
