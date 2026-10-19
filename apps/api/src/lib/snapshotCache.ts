import { redis } from './redis';
import { afterCommit } from './transaction';

const WRITE = `
local raw = redis.call('GET', KEYS[1])
local incoming = cjson.decode(ARGV[1])
if raw then
  local ok, old = pcall(cjson.decode, raw)
  if ok then
    local oldRev = old.revision or 0
    local newRev = incoming.revision or 0
    if oldRev > newRev then return 0 end
    if oldRev == newRev then
      local oldInnings = old.inningsNumber or 0
      local newInnings = incoming.inningsNumber or 0
      if oldInnings > newInnings then return 0 end
      if oldInnings == newInnings and old.lastEventSeq > incoming.lastEventSeq then return 0 end
    end
  end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1`;

export async function writeVersionedSnapshot(key: string, snapshot: unknown): Promise<void> {
  await afterCommit(async () => {
    await redis.eval(WRITE, 1, key, JSON.stringify(snapshot), 21_600);
  });
}
