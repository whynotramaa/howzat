import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import {
  discardQueue,
  listQueuedBalls,
  listLegacyBalls,
  type QueuedBall,
} from '@/lib/offlineBallQueue';
import { toast } from '@/components/ui/Toast';

export function QueueRecovery({ matchId, userId }: { matchId: string; userId: string }) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<QueuedBall[]>([]),
    [legacy, setLegacy] = useState<QueuedBall[]>([]),
    [busy, setBusy] = useState(false);
  async function inspect() {
    try {
      const [current, old] = await Promise.all([
        listQueuedBalls(matchId, userId),
        listLegacyBalls(matchId),
      ]);
      setRows(current);
      setLegacy(old);
      setOpen(true);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not read the queue', 'error');
    }
  }
  function download(items: QueuedBall[]) {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { version: 2, matchId, exportedAt: new Date().toISOString(), balls: items },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `howzat-${matchId}-unsynced.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function remove() {
    setBusy(true);
    try {
      download(rows);
      await discardQueue(
        matchId,
        userId,
        rows.map((row) => row.id),
      );
      setRows([]);
      toast('Queue exported and removed from this device. Saved match events are unchanged.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not clear the queue', 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void inspect()}
        className="min-h-11 px-2 text-xs text-muted hover:text-primary"
      >
        Queue recovery
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Recover unsynced balls">
        <div className="space-y-5 p-5">
          <p className="text-sm leading-6 text-secondary">
            These are submissions on this device. Export a copy before making changes. If a ball was
            rejected, remove the unsynced sequence and score it again against the current server
            score.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
            {rows.length ? (
              rows.map((row) => (
                <div key={row.id} className="border-b border-line px-4 py-3 text-sm last:border-0">
                  <p>
                    {row.input.runsOffBat} runs {row.input.isWicket ? '· wicket' : ''}
                    <span className="ml-2 text-xs text-muted">{row.status}</span>
                  </p>
                  {row.error ? <p className="mt-1 text-xs text-alert">{row.error}</p> : null}
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-muted">No pending balls for your account.</p>
            )}
          </div>
          {rows.length ? (
            <>
              <Button fullWidth variant="secondary" onClick={() => download(rows)}>
                Export unsynced balls
              </Button>
              <p className="text-xs leading-5 text-muted">
                The next action downloads a copy and removes all {rows.length} unsynced submissions
                for this account and match. You will need to re-enter any balls that have not
                reached the server.
              </p>
              <Button fullWidth variant="danger" isLoading={busy} onClick={() => void remove()}>
                Export and remove unsynced sequence
              </Button>
            </>
          ) : null}
          {legacy.length ? (
            <div className="rounded-xl border border-warning/40 bg-warning-soft p-4">
              <p className="text-sm text-primary">
                {legacy.length} older submissions have no recorded account. They will not sync
                automatically.
              </p>
              <Button className="mt-3" variant="secondary" onClick={() => download(legacy)}>
                Export older submissions
              </Button>
            </div>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
