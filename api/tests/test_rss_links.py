from app.jobs.rss_links import extract_feed_entry_links


def test_extract_rss2_item_links() -> None:
    xml = """<?xml version="1.0"?>
<rss version="2.0"><channel>
<item><title>A</title><link>https://jobs.example.com/one</link></item>
<item><link>https://jobs.example.com/two</link></item>
</channel></rss>"""
    links = extract_feed_entry_links(xml)
    assert links == ["https://jobs.example.com/one", "https://jobs.example.com/two"]


def test_extract_atom_entry_links() -> None:
    xml = """<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>x</title>
    <link href="https://careers.example.com/x" rel="alternate"/>
  </entry>
</feed>"""
    links = extract_feed_entry_links(xml)
    assert links == ["https://careers.example.com/x"]


def test_relative_links_resolved_with_base() -> None:
    xml = """<?xml version="1.0"?>
<rss version="2.0"><channel>
<item><link>/jobs/99</link></item>
</channel></rss>"""
    links = extract_feed_entry_links(xml, base_url="https://company.example/careers/")
    assert links == ["https://company.example/jobs/99"]
