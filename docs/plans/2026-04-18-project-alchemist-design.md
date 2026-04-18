# Project Alchemist Design: The Scientific Discovery Loop

## Overview
Project Alchemist is a collaborative system designed to bridge the gap between an AI's analytical capabilities and a human's physical agency. The goal is to facilitate real-world scientific discovery in the fields of Physics and Chemistry through a structured "Lab Notebook Protocol."

## The Discovery Loop
The system operates in a four-stage cycle:
1.  **Hypothesis & Protocol:** The AI generates a structured `protocol/` file defining hypotheses, procedures, and required data.
2.  **Physical Execution:** The human performs the experiment, recording observations in a physical paper notebook.
3.  **The Sync (Guided Entry):** The human uses a CLI tool to transcribe and validate notes from the paper notebook into the digital system.
4.  **Analysis & Branching:** The AI analyzes the structured data and proposes the next iteration or experiment.

## Architecture & Components

### 1. Data Structure
*   `protocols/`: YAML/Markdown definitions of experiment plans.
*   `experiments/`: Individual experiment folders containing narrative logs and result summaries.
*   `data/alchemist.db`: A SQLite database for structured, queryable numerical data (measurements).
*   `src/`: Node.js/Python CLI source code.

### 2. Protocol Schema
Each protocol includes:
*   `inputs`: Independent variables to be set.
*   `observations`: Dependent variables to be measured.
*   `safety`: Mandatory safety checks and environmental impact considerations.

### 3. CLI Functionality
*   `alchemy plan`: Generates a new protocol and experiment workspace.
*   `alchemy sync`: Initiates a guided interview to populate the database and Markdown logs from physical notes.
*   `alchemy abort`: Handles failed or interrupted experiments while preserving the narrative reason for failure.

## Data Integrity & Safety
*   **Validation:** CLI-side type checking and boundary alarms for physical measurements.
*   **Persistence:** JSON exports of the SQLite database triggered on every sync to ensure version-controlled, human-readable backups in Git.
*   **Safety Protocols:** Mandatory acknowledgement of safety procedures before an experiment can transition to the "Active" state.
