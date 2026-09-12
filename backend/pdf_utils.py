"""PDF utilities: render pages to base64 PNG, and fill text at coordinates."""
import base64
import io
import pymupdf


def pdf_to_page_images(pdf_bytes: bytes, dpi: int = 130):
    """Return list of {page, width, height, image} where width/height are PDF points."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for i, page in enumerate(doc):
        rect = page.rect
        pix = page.get_pixmap(dpi=dpi)
        img_b64 = base64.b64encode(pix.tobytes("png")).decode()
        pages.append({
            "page": i,
            "width": round(rect.width, 2),
            "height": round(rect.height, 2),
            "image": f"data:image/png;base64,{img_b64}",
        })
    doc.close()
    return pages


def image_to_pdf_bytes(image_bytes: bytes) -> bytes:
    """Convert a raster image (jpeg/png) into a single-page PDF."""
    doc = pymupdf.open(stream=image_bytes, filetype=None)
    pdf_bytes = doc.convert_to_pdf()
    doc.close()
    return pdf_bytes


def fill_pdf(pdf_bytes: bytes, placements: list) -> bytes:
    """placements: list of {page, x, y, value, font_size}. x/y in PDF points, top-left origin.
    y is treated as the top of the text; we offset to baseline."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    for p in placements:
        value = str(p.get("value", "") or "")
        if not value:
            continue
        page_index = int(p.get("page", 0))
        if page_index < 0 or page_index >= len(doc):
            continue
        page = doc[page_index]
        x = float(p.get("x", 0))
        y = float(p.get("y", 0))
        font_size = float(p.get("font_size", 11))
        # insert_point y is baseline; nudge down by font size so click-top aligns visually
        page.insert_text((x, y + font_size), value, fontsize=font_size,
                         fontname="helv", color=(0.05, 0.09, 0.16))
    out = doc.tobytes()
    doc.close()
    return out
