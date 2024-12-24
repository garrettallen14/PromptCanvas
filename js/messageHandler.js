class MessageHandler {
    constructor() {
        this.messages = [];
        this.onMessageCallback = null;
        this.onThinkingCallback = null;
        this.onErrorCallback = null;

        // Add initial system prompt
        this.addSystemMessage(`You are a pixel art assistant. You see the current canvas state in the image and can add to it using these commands:

BOX_FILL: (x1,y1) (x2,y2) (r,g,b)    - Fill a box from (x1,y1) to (x2,y2)
CIRCLE: (x,y) radius (r,g,b)          - Draw a circle at (x,y)
LINE: (x1,y1) (x2,y2) (r,g,b)        - Draw a line from (x1,y1) to (x2,y2)
BACKGROUND: (r,g,b)                   - Set background color
COLOR: (x,y) (r,g,b)                  - Draw a single point
TRIANGLE: (x1,y1) (x2,y2) (x3,y3) (r,g,b)  - Draw a triangle

- Coordinates must be 0-99 (or the current canvas dimensions, as they change)
- Colors (r,g,b) must be 0-255
- You can add to the existing image; no need to redraw everything
- Respond with commands only, one per line
- Add comments with # to explain your changes
- You must submit commands in the exact parentheses format or else the command will fail.`);
    }

    async addMessage(role, content, metadata = {}) {
        const message = {
            id: Date.now(),
            role,
            content,
            timestamp: new Date().toISOString(),
            ...metadata
        };

        this.messages.push(message);
        
        // Log message history to console
        // console.log('Message History:', this.messages);
        
        if (this.onMessageCallback) {
            this.onMessageCallback(message);
        }

        return message;
    }

    async addSystemMessage(content, metadata = {}) {
        return this.addMessage('system', content, metadata);
    }

    async addUserMessage(content, metadata = {}) {
        return this.addMessage('user', content, metadata);
    }

    async addAIMessage(content, metadata = {}) {
        return this.addMessage('assistant', content, metadata);
    }

    setThinking(isThinking) {
        if (this.onThinkingCallback) {
            this.onThinkingCallback(isThinking);
        }
    }

    handleError(error) {
        console.error('Error:', error);
        if (this.onErrorCallback) {
            this.onErrorCallback(error);
        }
        return this.addSystemMessage(`Error: ${error.message}`, { type: 'error' });
    }

    getHistory() {
        // Return messages with canvas state
        return this.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            canvasState: msg.canvasState // Include the canvas state
        }));
    }

    clear() {
        this.messages = [];
        if (this.onMessageCallback) {
            this.onMessageCallback(null);
        }
    }

    setCallbacks({
        onMessage = null,
        onThinking = null,
        onError = null
    } = {}) {
        this.onMessageCallback = onMessage;
        this.onThinkingCallback = onThinking;
        this.onErrorCallback = onError;
    }

    formatForLLM(canvasState = null) {
        const width = canvasState?.dimensions?.width || 100;
        const height = canvasState?.dimensions?.height || 100;
        
        const systemMessage = {
            role: "system",
            content: `You are a pixel art assistant. You see the current canvas state in the image and can add to it using these commands:

BOX_FILL: (x1,y1) (x2,y2) (r,g,b)    - Fill a box from (x1,y1) to (x2,y2)
CIRCLE: (x,y) radius (r,g,b)          - Draw a circle at (x,y)
LINE: (x1,y1) (x2,y2) (r,g,b)        - Draw a line from (x1,y1) to (x2,y2)
BACKGROUND: (r,g,b)                   - Set background color
COLOR: (x,y) (r,g,b)                  - Draw a single point
TRIANGLE: (x1,y1) (x2,y2) (x3,y3) (r,g,b)  - Draw a triangle

- Coordinates must be 0-${width-1} for x, 0-${height-1} for y
- Colors (r,g,b) must be 0-255
- You can add to the existing image; no need to redraw everything
- Respond with commands only, one per line
- Add comments with # to explain your changes

Canvas size: ${width}x${height}`
        };

        return [
            systemMessage,
            ...this.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ];
    }
}

class LLMAPIHandler {
    constructor(apiKey, model = 'anthropic/claude-3.5-sonnet') {
        this.apiKey = apiKey;
        this.model = model;
        this.baseURL = 'https://openrouter.ai/api/v1/chat/completions';
    }

    async generateResponse(messages) {
        try {
            const previousMessages = messages.slice(0, -1).map(msg => ({
                role: msg.role,
                content: msg.content
            }));
    
            const lastMessage = messages[messages.length - 1];
            
            // Format user changes if available
            let userContent = lastMessage.content;
            if (lastMessage.canvasState?.userChanges?.length > 0) {
                const changes = lastMessage.canvasState.userChanges
                    .map(c => `Pixel (${c.x},${c.y}) set to RGB(${c.color.join(',')})`)
                    .join('\n');
                userContent += '\n\nRecent canvas changes:\n' + changes;
            }
    
            const lastMessageFormatted = {
                role: lastMessage.role,
                content: lastMessage.canvasState?.imageData ? [
                    {
                        type: "text",
                        text: userContent
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: lastMessage.canvasState.imageData,
                            detail: "auto"
                        }
                    }
                ] : userContent
            };


            console.log([...previousMessages, lastMessageFormatted])
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/garrettallen14/promptcanvas',
                    'X-Title': 'PromptCanvas'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [...previousMessages, lastMessageFormatted],
                    temperature: 1.0,
                    stream: false  // Add this line
                })
            });

            if (!response.ok) {
                throw new Error('API request failed: ' + await response.text());
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error in generateResponse:', error);
            throw error;
        }
    }

    async getCanvasImageData(canvasState) {
        // Create a temporary canvas to generate image data
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        const width = canvasState.dimensions.width;
        const height = canvasState.dimensions.height;
        const pixelSize = 10; // Size of each grid cell in pixels

        tempCanvas.width = width * pixelSize;
        tempCanvas.height = height * pixelSize;

        // Fill with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw colored pixels
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (canvasState.coloredPixels[y][x]) {
                    const [r, g, b] = canvasState.grid[y][x];
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(
                        x * pixelSize,
                        y * pixelSize,
                        pixelSize,
                        pixelSize
                    );
                }
            }
        }

        return tempCanvas.toDataURL('image/png');
    }
}

// Export classes
window.MessageHandler = MessageHandler;
window.LLMAPIHandler = LLMAPIHandler;
