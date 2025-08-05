CREATE SCHEMA IF NOT EXISTS fieldviz;
USE fieldviz;

-- Enhanced Database Schema for Complex Oil Field Data
-- Supports tabular data extraction with multiple wells and parameters

-- Users table (unchanged)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'engineer', 'viewer') DEFAULT 'engineer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Oil fields table (enhanced)
CREATE TABLE oil_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    field_code VARCHAR(50),
    operator VARCHAR(255),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Wells table (new - for individual wells within fields)
CREATE TABLE wells (
    id INT AUTO_INCREMENT PRIMARY KEY,
    oil_field_id INT,
    well_name VARCHAR(255) NOT NULL,
    well_number VARCHAR(100),
    api_number VARCHAR(50),
    location_description TEXT,
    spud_date DATE,
    completion_date DATE,
    status ENUM('active', 'inactive', 'shut_in', 'abandoned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (oil_field_id) REFERENCES oil_fields(id) ON DELETE CASCADE,
    INDEX idx_well_name (well_name),
    INDEX idx_oil_field (oil_field_id)
);

-- Enhanced reports table
CREATE TABLE reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    oil_field_id INT,
    report_date DATE NOT NULL,
    report_type ENUM('daily', 'weekly', 'monthly', 'test') DEFAULT 'daily',
    status ENUM('pending', 'processing', 'completed', 'error', 'reviewing') DEFAULT 'pending',
    uploaded_by INT,
    processing_method ENUM('manual', 'ocr', 'enhanced_ocr', 'api') DEFAULT 'manual',
    total_wells_processed INT DEFAULT 0,
    total_parameters_extracted INT DEFAULT 0,
    average_confidence_score DECIMAL(4,3),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (oil_field_id) REFERENCES oil_fields(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    INDEX idx_report_date (report_date),
    INDEX idx_status (status),
    INDEX idx_oil_field_date (oil_field_id, report_date)
);

-- Well data snapshots (daily/periodic data for each well)
CREATE TABLE well_data_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT,
    well_id INT,
    snapshot_date DATE NOT NULL,
    data_source ENUM('ocr', 'manual', 'scada', 'test') DEFAULT 'ocr',
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (well_id) REFERENCES wells(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id),
    UNIQUE KEY unique_well_snapshot (well_id, snapshot_date, report_id),
    INDEX idx_snapshot_date (snapshot_date),
    INDEX idx_well_date (well_id, snapshot_date)
);

-- Enhanced field data table (individual parameter values)
CREATE TABLE field_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    snapshot_id INT,
    parameter_name VARCHAR(255) NOT NULL,
    parameter_value DECIMAL(15,4),
    parameter_value_text VARCHAR(100), -- For non-numeric values
    unit VARCHAR(50),
    confidence_score DECIMAL(4,3),
    cell_position_row INT,
    cell_position_col INT,
    ocr_bbox_x INT,
    ocr_bbox_y INT,
    ocr_bbox_width INT,
    ocr_bbox_height INT,
    original_text TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by INT,
    verified_at TIMESTAMP NULL,
    correction_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES well_data_snapshots(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id),
    INDEX idx_parameter_name (parameter_name),
    INDEX idx_snapshot_param (snapshot_id, parameter_name),
    INDEX idx_confidence (confidence_score),
    INDEX idx_verification (is_verified)
);

-- Enhanced images table
CREATE TABLE uploaded_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT,
    file_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255),
    file_size BIGINT,
    file_type VARCHAR(100),
    image_width INT,
    image_height INT,
    ocr_status ENUM('pending', 'processing', 'completed', 'failed', 'reviewing') DEFAULT 'pending',
    processing_time_seconds INT,
    table_detection_confidence DECIMAL(4,3),
    total_cells_detected INT,
    preprocessing_applied TEXT, -- JSON string of preprocessing steps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    INDEX idx_ocr_status (ocr_status),
    INDEX idx_report_image (report_id)
);

-- Parameter definitions (for validation and standardization)
CREATE TABLE parameter_definitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parameter_name VARCHAR(255) NOT NULL UNIQUE,
    standard_unit VARCHAR(50),
    alternative_units JSON, -- Array of alternative unit names
    parameter_category ENUM('production', 'pressure', 'temperature', 'flow', 'composition', 'other') DEFAULT 'other',
    data_type ENUM('numeric', 'text', 'boolean') DEFAULT 'numeric',
    min_expected_value DECIMAL(15,4),
    max_expected_value DECIMAL(15,4),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (parameter_category),
    INDEX idx_active (is_active)
);

-- OCR processing logs (for debugging and improvement)
CREATE TABLE ocr_processing_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_id INT,
    processing_step VARCHAR(100),
    step_status ENUM('started', 'completed', 'failed') DEFAULT 'started',
    processing_time_ms INT,
    confidence_scores JSON, -- Array of confidence scores
    extracted_text_length INT,
    error_message TEXT,
    debug_info JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES uploaded_images(id) ON DELETE CASCADE,
    INDEX idx_image_step (image_id, processing_step),
    INDEX idx_step_status (processing_step, step_status)
);

-- Data validation rules
CREATE TABLE validation_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parameter_name VARCHAR(255),
    rule_type ENUM('range', 'format', 'dependency', 'consistency') DEFAULT 'range',
    rule_definition JSON, -- Flexible rule storage
    severity ENUM('error', 'warning', 'info') DEFAULT 'warning',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_parameter_rule (parameter_name, rule_type),
    INDEX idx_active (is_active)
);

-- Sample data with enhanced structure
INSERT INTO oil_fields (name, location, field_code, operator) VALUES 
('West Texas Field A', 'Midland County, TX', 'WTF-A', 'FieldViz Energy'),
('North Dakota Field B', 'Williams County, ND', 'NDF-B', 'FieldViz Energy'),
('Oklahoma Field C', 'Oklahoma County, OK', 'OKF-C', 'FieldViz Energy'),
('Eagle Ford Shale', 'Karnes County, TX', 'EFS-1', 'FieldViz Energy'),
('Permian Basin Unit', 'Reeves County, TX', 'PBU-1', 'FieldViz Energy');

INSERT INTO wells (oil_field_id, well_name, well_number, api_number, status) VALUES 
(1, 'WTA-001', '001', '42-329-12345', 'active'),
(1, 'WTA-002', '002', '42-329-12346', 'active'),
(1, 'WTA-003', '003', '42-329-12347', 'active'),
(2, 'NDB-001', '001', '33-105-23456', 'active'),
(2, 'NDB-002', '002', '33-105-23457', 'active'),
(3, 'OKC-001', '001', '35-109-34567', 'active');

INSERT INTO users (email, password, name, role) VALUES 
('admin@fieldviz.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo Admin', 'admin'),
('engineer@fieldviz.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Field Engineer', 'engineer'),
('reviewer@fieldviz.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Data Reviewer', 'engineer');

-- Standard parameter definitions
INSERT INTO parameter_definitions (parameter_name, standard_unit, alternative_units, parameter_category, data_type, min_expected_value, max_expected_value, description) VALUES 
('Oil Production', 'BBL', '["bbl", "STB", "stb", "barrels"]', 'production', 'numeric', 0, 10000, 'Daily oil production in barrels'),
('Gas Production', 'MCF', '["mcf", "MSCF", "mscf", "SCF", "scf"]', 'production', 'numeric', 0, 50000, 'Daily gas production in thousand cubic feet'),
('Water Production', 'BBL', '["bbl", "STB", "stb", "barrels"]', 'production', 'numeric', 0, 5000, 'Daily water production in barrels'),
('Wellhead Pressure', 'PSI', '["psi", "PSIG", "psig"]', 'pressure', 'numeric', 0, 5000, 'Wellhead pressure in pounds per square inch'),
('Tubing Pressure', 'PSI', '["psi", "PSIG", "psig"]', 'pressure', 'numeric', 0, 5000, 'Tubing pressure in pounds per square inch'),
('Casing Pressure', 'PSI', '["psi", "PSIG", "psig"]', 'pressure', 'numeric', 0, 3000, 'Casing pressure in pounds per square inch'),
('Temperature', '°F', '["F", "deg F", "degrees F"]', 'temperature', 'numeric', 50, 300, 'Temperature in degrees Fahrenheit'),
('Water Cut', '%', '["percent", "pct"]', 'composition', 'numeric', 0, 100, 'Water cut percentage'),
('Flow Rate', 'BPD', '["bpd", "BOPD", "bopd"]', 'flow', 'numeric', 0, 2000, 'Flow rate in barrels per day'),
('Choke Size', '/64', '["64ths", "inch"]', 'flow', 'numeric', 0, 64, 'Choke size in 64ths of an inch'),
('Gas Oil Ratio', 'SCF/BBL', '["scf/bbl", "GOR"]', 'composition', 'numeric', 0, 10000, 'Gas to oil ratio');

-- Validation rules
INSERT INTO validation_rules (parameter_name, rule_type, rule_definition, severity, created_by) VALUES 
('Oil Production', 'range', '{"min": 0, "max": 10000, "message": "Oil production seems unusually high or negative"}', 'warning', 1),
('Gas Production', 'range', '{"min": 0, "max": 50000, "message": "Gas production seems unusually high or negative"}', 'warning', 1),
('Water Cut', 'range', '{"min": 0, "max": 100, "message": "Water cut must be between 0-100%"}', 'error', 1),
('Wellhead Pressure', 'range', '{"min": 0, "max": 5000, "message": "Pressure reading seems unusually high"}', 'warning', 1);

-- Views for easier data access
CREATE VIEW well_production_summary AS
SELECT 
    w.well_name,
    w.api_number,
    of.name as field_name,
    wds.snapshot_date,
    MAX(CASE WHEN fd.parameter_name = 'Oil Production' THEN fd.parameter_value END) as oil_production,
    MAX(CASE WHEN fd.parameter_name = 'Gas Production' THEN fd.parameter_value END) as gas_production,
    MAX(CASE WHEN fd.parameter_name = 'Water Production' THEN fd.parameter_value END) as water_production,
    MAX(CASE WHEN fd.parameter_name = 'Wellhead Pressure' THEN fd.parameter_value END) as wellhead_pressure,
    MAX(CASE WHEN fd.parameter_name = 'Temperature' THEN fd.parameter_value END) as temperature,
    AVG(fd.confidence_score) as avg_confidence,
    COUNT(fd.id) as parameter_count,
    SUM(CASE WHEN fd.is_verified = TRUE THEN 1 ELSE 0 END) as verified_count
FROM wells w
JOIN well_data_snapshots wds ON w.id = wds.well_id
JOIN field_data fd ON wds.id = fd.snapshot_id
JOIN oil_fields of ON w.oil_field_id = of.id
GROUP BY w.id, wds.snapshot_date
ORDER BY wds.snapshot_date DESC, w.well_name;

CREATE VIEW daily_field_summary AS
SELECT 
    of.name as field_name,
    wds.snapshot_date,
    COUNT(DISTINCT w.id) as active_wells,
    SUM(CASE WHEN fd.parameter_name = 'Oil Production' THEN fd.parameter_value ELSE 0 END) as total_oil_production,
    SUM(CASE WHEN fd.parameter_name = 'Gas Production' THEN fd.parameter_value ELSE 0 END) as total_gas_production,
    SUM(CASE WHEN fd.parameter_name = 'Water Production' THEN fd.parameter_value ELSE 0 END) as total_water_production,
    AVG(fd.confidence_score) as avg_confidence,
    COUNT(fd.id) as total_parameters,
    SUM(CASE WHEN fd.is_verified = TRUE THEN 1 ELSE 0 END) as verified_parameters
FROM oil_fields of
JOIN wells w ON of.id = w.oil_field_id
JOIN well_data_snapshots wds ON w.id = wds.well_id
JOIN field_data fd ON wds.id = fd.snapshot_id
GROUP BY of.id, wds.snapshot_date
ORDER BY wds.snapshot_date DESC, of.name;

-- Indexes for performance
CREATE INDEX idx_field_data_parameter_date ON field_data(parameter_name, created_at);
CREATE INDEX idx_well_snapshots_date ON well_data_snapshots(snapshot_date, well_id);
CREATE INDEX idx_confidence_verification ON field_data(confidence_score, is_verified);

-- Trigger to update report statistics
DELIMITER $$
CREATE TRIGGER update_report_stats_after_insert
AFTER INSERT ON field_data
FOR EACH ROW
BEGIN
    DECLARE report_id_val INT;
    
    SELECT r.id INTO report_id_val
    FROM reports r
    JOIN well_data_snapshots wds ON r.id = wds.report_id
    WHERE wds.id = NEW.snapshot_id;
    
    IF report_id_val IS NOT NULL THEN
        UPDATE reports 
        SET 
            total_parameters_extracted = (
                SELECT COUNT(*) 
                FROM field_data fd 
                JOIN well_data_snapshots wds ON fd.snapshot_id = wds.id 
                WHERE wds.report_id = report_id_val
            ),
            average_confidence_score = (
                SELECT AVG(fd.confidence_score) 
                FROM field_data fd 
                JOIN well_data_snapshots wds ON fd.snapshot_id = wds.id 
                WHERE wds.report_id = report_id_val
            ),
            total_wells_processed = (
                SELECT COUNT(DISTINCT wds.well_id) 
                FROM well_data_snapshots wds 
                WHERE wds.report_id = report_id_val
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = report_id_val;
    END IF;
END$$
DELIMITER ;