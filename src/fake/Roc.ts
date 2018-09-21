/* tslint:disable max-classes-per-file */
import { randomBytes } from 'crypto';

import { RocHTTPError } from '../Error';
import {
  BaseRoc,
  BaseRocDocument,
  IDocument,
  INewAttachment,
  INewDocument,
  INewRevisionMeta
} from '../RocBase';

export interface IRocData {
  [key: string]: IDocument[];
}

export class FakeDocument extends BaseRocDocument<FakeRoc> {
  protected roc: FakeRoc;
  constructor(roc: FakeRoc, data: string | IDocument) {
    if (typeof data === 'string') {
      super(roc, data);
    } else {
      super(roc, data._id);
      this.value = data;
    }
    this.roc = roc;
  }

  public async fetch(rev?: string) {
    const revs = this.roc.data[this.uuid];
    if (!revs) {
      throw new RocHTTPError(404, 'document not found');
    }
    const doc: IDocument | undefined = rev
      ? revs.find(d => d._rev === rev)
      : revs[revs.length - 1];

    if (doc === undefined) {
      throw new RocHTTPError(404, 'revision does not exist ');
    }
    this.value = doc;
    return doc;
  }

  public async update(
    content: object,
    newAttachments?: INewAttachment[],
    deleteAttachments?: string[]
  ) {
    if (newAttachments || deleteAttachments) {
      throw new Error('attachments not supported yet');
    }
    if (this.value === undefined) {
      await this.fetch();
    }
    const doc = this.value as IDocument;
    const newMeta = getNewRevisionMeta(doc._rev);
    const newDocument: IDocument = {
      ...doc,
      $content: content,
      ...newMeta
    };

    this.roc.data[this.uuid].push(newDocument);
    this.value = newDocument;
    return this;
  }
}

function getNewRevisionMeta(oldRev: string): INewRevisionMeta {
  const oldInc = oldRev.substr(0, 1);
  const newInc = +oldInc + 1;
  const rev = randomBytes(16).toString('hex');
  return {
    _rev: `${newInc}-${rev}`,
    $modificationDate: Date.now()
  };
}

export class FakeRoc extends BaseRoc<FakeDocument> {
  public static x: number = 2;
  public data: IRocData;

  constructor(rocData: IRocData) {
    super();
    this.data = rocData;
  }

  public async getDocument(uuid: string) {
    return new FakeDocument(this, uuid);
  }

  public async create(newDocument: INewDocument): Promise<FakeDocument> {
    const uuid = randomBytes(16).toString('hex');
    const rev = '1-' + randomBytes(16).toString('hex');
    const document: IDocument = {
      ...newDocument,
      _id: uuid,
      _rev: rev,
      $modificationDate: Date.now(),
      $creationDate: Date.now(),
      $owner: ['test@test.com', ...newDocument.$owner]
    };
    if (!this.data[uuid]) {
      this.data[uuid] = [];
    }
    this.data[uuid].push(document);
    return new FakeDocument(this, document);
  }

  public async getUser() {
    return 'test@test.com';
  }
}
