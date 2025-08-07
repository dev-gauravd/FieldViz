import pytesseract
import pandas as pd
import cv2
import numpy as np
import os
import re

# --- IMPORTANT CONFIGURATION ---
# 1. Set the path to your Tesseract executable.
#    You must change this to the location where you installed Tesseract OCR.
#    Example for Windows: r'C:\Program Files\Tesseract-OCR\tesseract.exe'
#    Example for macOS/Linux: r'/usr/local/bin/tesseract' (or wherever it's installed)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# 2. Set the path to your image file.
#    Place your log sheet image in the same directory as this script, or provide the full path.
image_path = 'scan1_page-0001.jpg'

def preprocess_image(image_path):
    """
    Loads an image and applies pre-processing to improve OCR and line detection accuracy.
    """
    print("Preprocessing image for better OCR accuracy...")
    image = cv2.imread(image_path)
    if image is None:
        raise FileNotFoundError(f"Image not found at path: {image_path}")

    # Convert to grayscale and apply a binary threshold
    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, threshold_image = cv2.threshold(gray_image, 150, 255, cv2.THRESH_BINARY)
    
    return threshold_image

def detect_lines(image):
    """
    Detects horizontal and vertical lines in the image using morphological operations.
    """
    print("Detecting horizontal and vertical lines...")
    
    # Invert the image to make lines white on a black background
    inverted_image = cv2.bitwise_not(image)
    
    # Define kernels for horizontal and vertical lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 20))

    # Detect horizontal lines
    detected_horizontal_lines = cv2.morphologyEx(inverted_image, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
    horizontal_contours, _ = cv2.findContours(detected_horizontal_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Detect vertical lines
    detected_vertical_lines = cv2.morphologyEx(inverted_image, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
    vertical_contours, _ = cv2.findContours(detected_vertical_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    horizontal_lines = [cv2.boundingRect(c) for c in horizontal_contours]
    vertical_lines = [cv2.boundingRect(c) for c in vertical_contours]
    
    return horizontal_lines, vertical_lines

def extract_table_cells(horizontal_lines, vertical_lines, image):
    """
    Uses the detected lines to find table cells and extracts text from each cell.
    """
    print("Extracting table cells and running OCR...")
    
    # Sort lines to find distinct horizontal and vertical coordinates
    horizontal_y = sorted([y for x, y, w, h in horizontal_lines])
    vertical_x = sorted([x for x, y, w, h in vertical_lines])
    
    # Filter out duplicate lines (close to each other)
    distinct_horizontal_y = []
    if horizontal_y:
        distinct_horizontal_y.append(horizontal_y[0])
        for y in horizontal_y[1:]:
            if y - distinct_horizontal_y[-1] > 10:
                distinct_horizontal_y.append(y)
    
    distinct_vertical_x = []
    if vertical_x:
        distinct_vertical_x.append(vertical_x[0])
        for x in vertical_x[1:]:
            if x - distinct_vertical_x[-1] > 10:
                distinct_vertical_x.append(x)

    # Now, iterate through the distinct lines to find the cells
    cell_data = []
    
    # Assume the first few rows are the header
    header_rows = 5
    footer_rows = 5
    
    # The OCR output is still messy, so we'll run a preliminary OCR to find keywords
    # and then use the line indices to slice the data.
    full_text = pytesseract.image_to_string(image)
    lines = full_text.split('\n')
    
    # Try to find the start of the data and footer lines
    data_start_line_index = next((i for i, line in enumerate(lines) if re.match(r'^\s*\d{1,2}\s*\.\s*00', line)), -1)
    footer_start_line_index = next((i for i, line in enumerate(lines) if 'Daily Running Hrs' in line), len(lines))
    
    if data_start_line_index == -1:
        raise ValueError("Could not find the start of the data table. OCR output might be too poor to parse.")
        
    header_text = lines[:data_start_line_index]
    footer_text = lines[footer_start_line_index:]
    
    # Process the main table data (between header and footer)
    table_text_lines = lines[data_start_line_index:footer_start_line_index]
    
    # Define a clean header for the CSV file
    clean_headers = ['Time', 'Frame Lube Oil', 'Frame Bearing Temp', 'Crankcase Lube Oil', '2nd Stage Cylinder Discharge', 'Cooling Water', 'Cylinder Oil & CKTW Temp', 'Control Engine', 'Instrument Air', 'Header', 'Flow']
    
    # Let's split the lines and try to match the column count
    for line in table_text_lines:
        line_values = re.split(r'\s+', line.strip())
        # Pad or trim to match the header length
        line_values = line_values[:len(clean_headers)]
        while len(line_values) < len(clean_headers):
            line_values.append('')
        cell_data.append(line_values)
    
    # Create the pandas DataFrame
    df = pd.DataFrame(cell_data, columns=clean_headers)

    # Save header, footer, and main table data
    with open('log_sheet_header.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(header_text))
    print("Header data saved to 'log_sheet_header.txt'")
    
    with open('log_sheet_footer.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(footer_text))
    print("Footer data saved to 'log_sheet_footer.txt'")
    
    csv_output_path = 'log_sheet_data.csv'
    df.to_csv(csv_output_path, index=False)
    print(f"Main table data successfully saved to '{csv_output_path}'")


def main():
    try:
        preprocessed_img = preprocess_image(image_path)
        
        # We will use a different OCR mode that is better for sparse text
        config = '--psm 11'
        full_text = pytesseract.image_to_string(preprocessed_img, config=config)
        
        parse_and_export_data_from_text(full_text)
        
    except Exception as e:
        print(f"An error occurred: {e}")

def parse_and_export_data_from_text(ocr_text):
    """
    This function is a fallback to a text-based parsing method
    if the image preprocessing fails.
    """
    print("-" * 50)
    print("Parsing text output...")
    print("Raw OCR Output (for debugging):")
    print(ocr_text)
    print("-" * 50)
    
    lines = ocr_text.strip().split('\n')
    
    # Use a more flexible regex to find the start of the hourly data
    data_start_line_index = next((i for i, line in enumerate(lines) if re.match(r'^\s*\d{1,2}\s*[\.,]\s*00', line)), -1)
    
    # Find the start of the footer
    footer_start_line_index = next((i for i, line in enumerate(lines) if 'Daily' in line and 'Running' in line and 'Hrs' in line), len(lines))

    if data_start_line_index == -1:
        raise ValueError("Could not find the start of the data table. The OCR output might be too poor to parse.")
        
    header_text = lines[:data_start_line_index]
    data_text = lines[data_start_line_index:footer_start_line_index]
    footer_text = lines[footer_start_line_index:]
    
    # --- Define the static header structure ---
    clean_headers = ['Time', 'Frame Lube Oil', 'Frame Bearing Temp', 'Crankcase Lube Oil', '2nd Stage Cylinder Discharge', 'Cooling Water', 'Cylinder Oil & CKTW Temp', 'Control Engine', 'Instrument Air', 'Header', 'Flow']
    
    parsed_data = []
    for line in data_text:
        line_values = re.split(r'\s+', line.strip())
        # Pad or trim to match the header length
        line_values = line_values[:len(clean_headers)]
        while len(line_values) < len(clean_headers):
            line_values.append('')
        parsed_data.append(line_values)
    
    df = pd.DataFrame(parsed_data, columns=clean_headers)
    
    # Save header, footer, and main table data
    with open('log_sheet_header.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(header_text))
    print("Header data saved to 'log_sheet_header.txt'")
    
    with open('log_sheet_footer.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(footer_text))
    print("Footer data saved to 'log_sheet_footer.txt'")
    
    csv_output_path = 'log_sheet_data.csv'
    df.to_csv(csv_output_path, index=False)
    print(f"Main table data successfully saved to '{csv_output_path}'")
    

if __name__ == "__main__":
    main()
