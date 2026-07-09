import app from '../src/app';
import { IncomingMessage, ServerResponse } from 'http';

// Disable Vercel's automatic body parsing so that multer can handle
// multipart/form-data (file uploads) correctly.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req, res);
}