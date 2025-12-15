import express from 'express';
import cors from 'cors';
import { YoutubeTranscript } from 'youtube-transcript';

const app = express();
const PORT = 3001;

// Enable CORS for all origins (in development)
app.use(cors());
app.use(express.json());

// YouTube transcript endpoint
app.post('/api/youtube-transcript', async (req, res) => {
    try {
        const { videoId } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        console.log(`[Backend] Fetching transcript for video: ${videoId}`);

        // Fetch transcript
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

        if (!transcriptItems || transcriptItems.length === 0) {
            return res.status(404).json({
                error: 'No transcript available for this video. The video may not have captions.'
            });
        }

        // Combine all transcript items into a single text
        const fullTranscript = transcriptItems
            .map(item => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        console.log(`[Backend] Successfully fetched transcript (${fullTranscript.length} characters)`);

        res.json({ transcript: fullTranscript });

    } catch (error: any) {
        console.error('[Backend] Error fetching transcript:', error);

        // Handle common errors
        if (error.message?.includes('Transcript is disabled')) {
            return res.status(404).json({
                error: 'Transcripts are disabled for this video.'
            });
        }

        if (error.message?.includes('Could not find')) {
            return res.status(404).json({
                error: 'No transcript found for this video. The video may not have captions enabled.'
            });
        }

        res.status(500).json({
            error: `Failed to fetch transcript: ${error.message || 'Unknown error'}`
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'YouTube Transcript API is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 YouTube Transcript Backend running on http://localhost:${PORT}`);
    console.log(`📝 API endpoint: http://localhost:${PORT}/api/youtube-transcript`);
});
