import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import pandas as pd

# Load your scanned image (make sure this file is in the same directory)
image_path = "scan1_page-0001.jpg"
img = Image.open(image_path)

# Define the number of rows and columns in your log table
NUM_ROWS = 24     # You can scale up after testing
NUM_COLS = 35

# For testing, extract a sample (5 rows x 10 columns)
SAMPLE_ROWS = 5
SAMPLE_COLS = 10

# Get image dimensions and calculate cell size
width, height = img.size
cell_width = width // NUM_COLS
cell_height = height // NUM_ROWS

# Container for extracted data
data = []

for row_idx in range(SAMPLE_ROWS):
    row_data = []
    for col_idx in range(SAMPLE_COLS):
        left = col_idx * cell_width
        upper = row_idx * cell_height
        right = left + cell_width
        lower = upper + cell_height

        cell_img = img.crop((left, upper, right, lower))

        # Enhance the cell image for better OCR
        cell_img = cell_img.convert("L")
        cell_img = ImageEnhance.Contrast(cell_img).enhance(2.0)
        cell_img = cell_img.filter(ImageFilter.SHARPEN)

        # Extract text from each cell
        text = pytesseract.image_to_string(cell_img, config='--psm 6')
        cleaned = text.strip().replace('|', '')
        row_data.append(cleaned)

    data.append(row_data)

# Create DataFrame
headers = [f"Col{i+1}" for i in range(SAMPLE_COLS)]
df = pd.DataFrame(data, columns=headers)

# Save to Excel
df.to_excel("output_sample.xlsx", index=False)
print("Saved to output_sample.xlsx")
