# PromptCanvas

A pixel art interface for understanding how language models interpret and visualize concepts through drawing.

https://garrettallen14.github.io/PromptCanvas/

## What it does

PromptCanvas lets you:
- Collaborate with LLMs on pixel art creation
- Explore how models interpret abstract concepts visually  
- See differences in how models approach creative tasks
- Study model personality through artistic expression

## Technical Overview

Core components:
```
├── CanvasManager      # Handles pixel grid state & drawing
├── MessageHandler     # Manages LLM communication
└── CommandParser     # Translates LLM output to drawing commands
```

Commands available to the LLM:
```python
BACKGROUND: (r,g,b)                        # Set background
COLOR: (x,y) (r,g,b)                       # Draw a single point
BOX_FILL: (x1,y1) (x2,y2) (r,g,b)          # Draw rectangle  
CIRCLE: (x,y) radius (r,g,b)               # Draw circle
LINE: (x1,y1) (x2,y2) (r,g,b)              # Draw line
TRIANGLE: (x1,y1) (x2,y2) (x3,y3) (r,g,b)  # Draw a triangle
```

## Setup

1. Clone repo
2. Get OpenRouter API key
3. Open index.html
4. Start drawing

## Implementation Notes

- Zero dependencies, just vanilla JS
- Pixel-perfect coordinate system
- Built-in state tracking
- Command validation and error handling
- Change history for analysis

## Usage

Basic workflow:
1. Draw or start blank
2. Describe what you want
3. Watch the LLM execute
4. Iterate

The system tracks all changes for analyzing model behavior.

## License

MIT