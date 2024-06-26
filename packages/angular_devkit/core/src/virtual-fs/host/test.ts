/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { Observable } from 'rxjs';
import { Path, PathFragment, join, normalize } from '../path';
import { fileBufferToString, stringToFileBuffer } from './buffer';
import { FileBuffer, HostWatchEvent, HostWatchOptions, Stats } from './interface';
import { SimpleMemoryHost, SimpleMemoryHostStats } from './memory';
import { SyncDelegateHost } from './sync';

export type TestLogRecord =
  | {
      kind:
        | 'write'
        | 'read'
        | 'delete'
        | 'list'
        | 'exists'
        | 'isDirectory'
        | 'isFile'
        | 'stat'
        | 'watch';
      path: Path;
    }
  | {
      kind: 'rename';
      from: Path;
      to: Path;
    };

export class TestHost extends SimpleMemoryHost {
  protected _records: TestLogRecord[] = [];
  protected _sync: SyncDelegateHost<{}> | null = null;

  constructor(map: { [path: string]: string } = {}) {
    super();

    for (const filePath of Object.getOwnPropertyNames(map)) {
      this._write(normalize(filePath), stringToFileBuffer(map[filePath]));
    }
  }

  get records(): TestLogRecord[] {
    return [...this._records];
  }
  clearRecords(): void {
    this._records = [];
  }

  get files(): Path[] {
    const sync = this.sync;
    function _visit(p: Path): Path[] {
      return sync
        .list(p)
        .map((fragment) => join(p, fragment))
        .reduce((files, path) => {
          if (sync.isDirectory(path)) {
            return files.concat(_visit(path));
          } else {
            return files.concat(path);
          }
        }, [] as Path[]);
    }

    return _visit(normalize('/'));
  }

  get sync(): SyncDelegateHost<{}> {
    if (!this._sync) {
      this._sync = new SyncDelegateHost<{}>(this);
    }

    return this._sync;
  }

  clone(): TestHost {
    const newHost = new TestHost();
    newHost._cache = new Map(this._cache);

    return newHost;
  }

  // Override parents functions to keep a record of all operators that were done.
  protected override _write(path: Path, content: FileBuffer): void {
    this._records.push({ kind: 'write', path });

    return super._write(path, content);
  }
  protected override _read(path: Path): ArrayBuffer {
    this._records.push({ kind: 'read', path });

    return super._read(path);
  }
  protected override _delete(path: Path): void {
    this._records.push({ kind: 'delete', path });

    return super._delete(path);
  }
  protected override _rename(from: Path, to: Path): void {
    this._records.push({ kind: 'rename', from, to });

    return super._rename(from, to);
  }
  protected override _list(path: Path): PathFragment[] {
    this._records.push({ kind: 'list', path });

    return super._list(path);
  }
  protected override _exists(path: Path): boolean {
    this._records.push({ kind: 'exists', path });

    return super._exists(path);
  }
  protected override _isDirectory(path: Path): boolean {
    this._records.push({ kind: 'isDirectory', path });

    return super._isDirectory(path);
  }
  protected override _isFile(path: Path): boolean {
    this._records.push({ kind: 'isFile', path });

    return super._isFile(path);
  }
  protected override _stat(path: Path): Stats<SimpleMemoryHostStats> | null {
    this._records.push({ kind: 'stat', path });

    return super._stat(path);
  }
  protected override _watch(path: Path, options?: HostWatchOptions): Observable<HostWatchEvent> {
    this._records.push({ kind: 'watch', path });

    return super._watch(path, options);
  }

  $write(path: string, content: string): void {
    return super._write(normalize(path), stringToFileBuffer(content));
  }

  $read(path: string): string {
    return fileBufferToString(super._read(normalize(path)));
  }

  $list(path: string): PathFragment[] {
    return super._list(normalize(path));
  }

  $exists(path: string): boolean {
    return super._exists(normalize(path));
  }

  $isDirectory(path: string): boolean {
    return super._isDirectory(normalize(path));
  }

  $isFile(path: string): boolean {
    return super._isFile(normalize(path));
  }
}
