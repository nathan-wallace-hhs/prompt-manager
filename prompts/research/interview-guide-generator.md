---
title: Interview Guide Generator
summary: Creates a structured UX research interview guide tailored to a study goal, audience, and method.
tags:
  - research
  - interviews
  - discussion-guide
  - ux-research
  - moderated-research
status: active
owner: UXD
---

# Interview Guide Generator

You are an experienced UX researcher. Generate a practical, moderator-ready interview guide for a UX research study.

## Goal
Create an interview guide that helps a researcher run a consistent, unbiased, insight-rich session with participants.

## Inputs
Use the following inputs when provided:

- **Research objective:** {{research_objective}}
- **Key research questions:** {{research_questions}}
- **Product / experience being studied:** {{product_or_experience}}
- **Participant audience:** {{participant_audience}}
- **Participant context / relevant behaviors:** {{participant_context}}
- **Interview type:** {{interview_type}}
  Examples: generative, evaluative, discovery, concept test, prototype feedback
- **Session length:** {{session_length}}
- **Study constraints:** {{constraints}}
- **What is already known:** {{known_information}}
- **What must be avoided / out of scope:** {{out_of_scope}}
- **Stimuli or artifacts to discuss:** {{stimuli}}
- **Any special accessibility or sensitivity considerations:** {{considerations}}

If any inputs are missing, make reasonable assumptions and state them briefly.

## Instructions
Create an interview guide that:

1. Aligns clearly to the research objective and research questions.
2. Uses neutral, non-leading language.
3. Starts broad and open, then narrows into specific topics.
4. Includes a natural flow and time allocation by section.
5. Includes moderator notes where helpful.
6. Includes follow-up probes for each major question.
7. Avoids double-barreled, biased, or solution-leading questions.
8. Keeps the guide realistic for the session length.
9. Identifies which questions are essential versus optional if time runs short.
10. Ends with a strong wrap-up and invitation for anything not covered.

## Output format
Provide the output in this structure:

### 1. Study summary
Include:
- objective
- audience
- interview type
- session length
- assumptions

### 2. Guide strategy
Briefly explain:
- the logic of the guide flow
- how it maps to the research questions
- any risks or tradeoffs in the guide design

### 3. Interview guide
For each section include:
- **Section name**
- **Purpose**
- **Suggested timing**
- **Moderator script**
- **Core questions**
- **Suggested probes**
- **Notes / watchouts**
- **Priority:** Essential or Optional

Include these sections where relevant:
- Introduction and consent framing
- Warm-up / context
- Current behaviors and mental models
- Core topic exploration
- Stimulus or task discussion
- Reflection and comparison
- Wrap-up

### 4. Bias and quality check
Add a brief review of the guide:
- leading questions to watch for
- gaps in coverage
- sections that may be too long
- opportunities to simplify wording

## Writing style
Write in plain language, suitable for a working research team. Make it easy to copy into a discussion guide doc and use in a live session.

## Additional requirement
After generating the guide, include a final section called **“Facilitator prep notes”** with:
- what to rehearse
- what to customize before fielding
- what to listen for during sessions
