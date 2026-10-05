"""Extracts just the dictionary body files from the GCIDE tarball."""

import os
import tarfile
import time

CACHE = os.path.dirname(os.path.abspath(__file__)) + "/.cache"

t0 = time.time()
with tarfile.open(CACHE + "/gcide.tar.xz") as tar:
    members = [m for m in tar.getmembers() if os.path.basename(m.name).startswith("CIDE.")]
    print("CIDE files:", len(members))
    tar.extractall(CACHE + "/gcide", members=members, filter="data")

print("extracted in %.1fs" % (time.time() - t0))
for root, _, files in os.walk(CACHE + "/gcide"):
    for name in sorted(files)[:3]:
        print(" ", os.path.join(root, name).replace(CACHE, ""), round(os.path.getsize(os.path.join(root, name)) / 1e6, 1), "MB")
    break
