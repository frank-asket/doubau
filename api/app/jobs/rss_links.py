from __future__ import annotations

import xml.etree.ElementTree as ET
from urllib.parse import urljoin


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def extract_feed_entry_links(xml_text: str, *, base_url: str | None = None) -> list[str]:
    """
    Extract entry/article URLs from RSS 2.0 or Atom feeds.

    Returns absolute http(s) URLs when possible; relative paths are resolved with ``base_url``.
    """
    text = xml_text.strip()
    if not text:
        return []

    try:
        root = ET.fromstring(text.encode("utf-8", errors="replace"))
    except ET.ParseError:
        return []

    raw: list[str] = []
    root_ln = _local_name(root.tag).lower()

    if root_ln == "rss":
        for item in root.iter():
            if _local_name(item.tag).lower() != "item":
                continue
            link_text: str | None = None
            guid_link: str | None = None
            for child in item:
                ln = _local_name(child.tag).lower()
                if ln == "link" and (child.text or "").strip():
                    link_text = (child.text or "").strip()
                    break
                if ln == "guid" and (child.text or "").strip():
                    t = (child.text or "").strip()
                    if t.startswith("http://") or t.startswith("https://"):
                        guid_link = t
            chosen = link_text or guid_link
            if chosen:
                raw.append(chosen)

    elif root_ln == "feed":
        for entry in root.iter():
            if _local_name(entry.tag).lower() != "entry":
                continue
            href: str | None = None
            for child in entry:
                if _local_name(child.tag).lower() != "link":
                    continue
                rel = (child.attrib.get("rel") or "alternate").lower()
                if rel not in ("alternate", "self"):
                    continue
                h = child.attrib.get("href")
                if h:
                    href = h.strip()
                    break
            if href:
                raw.append(href)

    seen: set[str] = set()
    out: list[str] = []
    for u in raw:
        u = u.strip()
        if not u:
            continue
        if base_url and not (u.startswith("http://") or u.startswith("https://")):
            u = urljoin(base_url, u)
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out
