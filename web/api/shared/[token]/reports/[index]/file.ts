import { handleSharedRequest } from '../../../../../server/sharedReports.js'
import { supabaseShareStore } from '../../../../../server/supabaseShareStore.js'

// GET /api/shared/:token/reports/:index/file: one shared report's original PDF,
// streamed through here so its storage path, which names the owner's account,
// never leaves the server (S10.3). Every other method is refused.
const handle = (request: Request) =>
  handleSharedRequest(request, supabaseShareStore)

// The writes are listed so that they reach the 405 answer too.
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
}
