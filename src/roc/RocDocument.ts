import { AxiosInstance } from 'axios';

import { IAttachment } from '..';
import { RocClientError } from '../Error';
import {
  IDocument,
  IDocumentDraft,
  IFetchAttachmentOptions,
  INewAttachment,
} from '../types';

import { addInlineUploads, deleteInlineUploads } from './utils';

export default class RocDocument<ContentType = Record<string, unknown>> {
  private request: AxiosInstance;
  public uuid: string;
  public rev?: string;
  protected value?: IDocument<ContentType>;
  public deleted: boolean;

  public constructor(uuid: string, request: AxiosInstance) {
    this.request = request;
    this.deleted = false;
    this.uuid = uuid;
  }

  public async fetchAttachment(
    name: string,
    options: IFetchAttachmentOptions = {
      type: 'text',
    },
  ): Promise<Buffer | string> {
    const url = new URL(name, this.getBaseUrl()).href;
    const response = await this.request({
      url,
      responseType: options.type,
    });
    return response.data;
  }

  public async fetch(rev?: string): Promise<IDocument<ContentType>> {
    if (rev) {
      throw new Error('UNIMPLEMENTED fetch with rev');
    }
    const response = await this.request.get('/');
    this.value = response.data;
    return response.data;
  }

  public async update(
    content: ContentType,
    newAttachments?: INewAttachment[],
    deleteAttachments?: string[],
  ): Promise<IDocument<ContentType>> {
    await this._fetchIfUnfetched();
    let newDoc: IDocumentDraft<ContentType> = {
      ...this.value,
      $content: content,
    };

    if (deleteAttachments !== undefined) {
      newDoc = deleteInlineUploads(newDoc, deleteAttachments);
    }

    if (newAttachments !== undefined) {
      newDoc = await addInlineUploads(newDoc, newAttachments);
    }

    // Send the new doc
    await this.request.put('', newDoc);

    // Get the new document
    // With updated properties ($lastModifification...)
    // And new attachment list

    await this.fetch();
    return this.value;
  }

  public getAttachmentList(): IAttachment[] {
    if (this.value === undefined) {
      throw new RocClientError(
        'You must fetch the document in order to get the attachment list',
      );
    }

    // value must be defined after fetch
    const doc = this.value;
    const attachments = doc._attachments || {};
    const list = [];
    for (const key in attachments) {
      list.push(this.getAttachment(key));
    }
    return list;
  }

  public async delete() {
    const response = await this.request.delete('/');
    if (response.data.ok) {
      this.value = undefined;
      this.deleted = true;
    } else {
      throw new Error('document was not deleted');
    }
  }
  public getAttachment(name: string): IAttachment {
    if (this.value === undefined) {
      throw new RocClientError(
        'You must fetch the document in order to get an attachment',
      );
    }
    const doc = this.value;
    const attachments = doc._attachments || {};
    if (!attachments[name]) {
      throw new RocClientError(`attachment ${name} does not exist`);
    }
    return {
      ...attachments[name],
      name,
      url: `${this.getBaseUrl()}${name}`,
    };
  }

  public getValue() {
    return this.value;
  }

  public toJSON() {
    return this.getValue();
  }

  public addGroups(/* groups: string | string[] */): Promise<string[]> {
    throw new Error('UNIMPLEMENTED addGroups');
  }

  public async hasRight(right: string) {
    const response = await this.request.get(`_rights/${right}`);
    return response.data;
  }

  protected getBaseUrl() {
    return this.request.defaults.baseURL || '';
  }
  private async _fetchIfUnfetched() {
    if (this.value === undefined) {
      await this.fetch();
    }
  }
}
