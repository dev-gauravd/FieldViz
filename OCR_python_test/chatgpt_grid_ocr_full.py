
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import pandas as pd

# === CONFIGURATION ===
IMAGE_PATH = "scan1_page-0001.jpg"
NUM_ROWS = 24        # Number of hourly entries (08:00 to 07:00)
NUM_COLS = 35        # Total columns in the compressor log table
OUTPUT_FILE = "compressor_log_extracted.xlsx"

# === LOAD IMAGE ===
img = Image.open(IMAGE_PATH)
width, height = img.size
cell_width = width // NUM_COLS
cell_height = height // NUM_ROWS

# === PROCESS EACH CELL ===
extracted_data = []

for row_idx in range(NUM_ROWS):
    row_values = []
    for col_idx in range(NUM_COLS):
        # Define cell box coordinates
        left = col_idx * cell_width
        upper = row_idx * cell_height
        right = left + cell_width
        lower = upper + cell_height

        # Crop the cell
        cell = img.crop((left, upper, right, lower))

        # Preprocess cell image
        cell = cell.convert("L")
        cell = ImageEnhance.Contrast(cell).enhance(2.0)
        cell = cell.filter(ImageFilter.SHARPEN)

        # OCR
        text = pytesseract.image_to_string(cell, config='--psm 7 -c tessedit_char_whitelist=0123456789./-%')
        cleaned = text.strip().replace('|', '')
        row_values.append(cleaned)

    extracted_data.append(row_values)

# === DEFINE PLACEHOLDER HEADERS (or use real ones if available) ===
headers = [f"Col{i+1}" for i in range(NUM_COLS)]

# === SAVE TO EXCEL ===
df = pd.DataFrame(extracted_data, columns=headers)
df.to_excel(OUTPUT_FILE, index=False)
print(f"Extraction complete. Saved to {OUTPUT_FILE}")
