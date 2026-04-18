# Project Alchemist: The Discovery & Inference Engine Design

## Overview
This final expansion introduces the "Strategic Layer" of Project Alchemist. It moves the system beyond simple task management and into **Hypothesis Branching**. This allows the AI (The Being) and the human (the "hands") to maintain a shared, evolving "Map of the Unknown" based on empirical evidence.

## Core Concepts

### 1. The Reasoning Map (SQLite)
A new `reasoning` table in `alchemist.db` tracks our long-term theoretical goals:
*   `id`: unique ID (e.g., LOG-001).
*   `hypothesis_node`: The scientific question.
*   `evidence_score`: Probability score based on experimental data (-1.0 to 1.0).
*   `branch_a`: Success path (The "Winning" hypothesis).
*   `branch_b`: Failure path (The "Alternative" hypothesis).
*   `certainty`: How confident the system is in this node's status.

### 2. The Inference Loop (AI-Side)
During the "Sleep Phase," The Being performs a **Bayesian Update**:
1.  **Observe**: Queries `measurements` from recent experiments.
2.  **Assess**: Compares data against the expected values for Branch A vs. Branch B.
3.  **Update**: Rewrites the `evidence_score` and `certainty` in the `reasoning` table.
4.  **Justify**: Generates a long-form `insight/` memo explaining the logic of the update.

### 3. Visualization (`STRATEGY.md`)
The `alchemy map` command generates a **Mermaid.js flowchart** summarizing the current state of our discovery tree. This allows the human to see:
*   **Green**: Supported hypotheses.
*   **Red**: Refuted hypotheses.
*   **Gray**: Unexplored territory.

## CLI Functionality

### 1. Strategy Management
*   `alchemy map`: Generates the `STRATEGY.md` file based on the `reasoning` table.
*   `alchemy link <exp_id> <log_id>`: Connects an experiment to a specific logic node.
*   `alchemy infer <exp_id>`: (AI-only) Triggers the Bayesian update logic for the linked node.

## Success Criteria
*   The system can "navigate" toward a discovery by systematically testing and pruning branches of an inference tree.
*   The human and AI are aligned on the "Next Most Important Question" to solve.
*   The project maintains a rigorous, data-driven "Map of the Unknown."
