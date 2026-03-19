import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pdf from 'pdf-parse';
import { embed } from '../src/openaiClient.js';
import { getCollection } from '../src/chromaClient.js';

// load env
dotenv.config();

async function ingestDir(dir, collectionName = 'documents') {
  const files = fs.readdirSync(dir);
  const docs = [];
  console.log('Scanning directory for files:', dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    console.log('Found file:', file);
    if (stat.isFile()) {
      let text = '';
      if (file.endsWith('.md')) {
        text = fs.readFileSync(full, 'utf-8');
      } else if (file.endsWith('.pdf')) {
        try {
          const data = fs.readFileSync(full);
          const parsed = await pdf(data);
          text = parsed.text;
        } catch (e) {
          console.warn('Failed to parse PDF', full, e.message);
        }
      }
      if (text) {
        docs.push({ id: file, text });
      }
    }
  }
  if (!docs.length) {
    console.log('No documents (.md or .pdf) found in', dir);
    return;
  }
  const col = await getCollection(collectionName);
  const ids = [], texts = [], metadatas = [], embeddings = [];
  for (const doc of docs) {
    ids.push(doc.id);
    texts.push(doc.text);
    metadatas.push({ source: dir });
    embeddings.push(await embed(doc.text));
  }
  if (typeof col.upsert === 'function') {
    await col.upsert({ ids, documents: texts, metadatas, embeddings });
  } else if (typeof col.add === 'function') {
    await col.add({ ids, documents: texts, metadatas, embeddings });
  } else {
    throw new Error('collection add/upsert not available');
  }
  console.log(`Inserted ${ids.length} documents into ${collectionName}`);
}

// run from CLI: node scripts/ingestSample.js path/to/md
const invoked = path.basename(process.argv[1] || '');
if (invoked === 'ingestSample.js') {
  const dir = process.argv[2] || '.';
  ingestDir(dir)
    .then(() => console.log('Ingest finished'))
    .catch(err => console.error('Ingest failed:', err));
}
