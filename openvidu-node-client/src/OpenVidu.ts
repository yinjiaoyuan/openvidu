/*
 * (C) Copyright 2017-2018 OpenVidu (https://openvidu.io/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { Session } from './Session';
import { SessionProperties } from './SessionProperties';
import { Recording } from './Recording';
import { RecordingLayout } from './RecordingLayout';
import { RecordingProperties } from './RecordingProperties';

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export class OpenVidu {

  private static readonly API_RECORDINGS: string = '/api/recordings';
  private static readonly API_RECORDINGS_START: string = '/start';
  private static readonly API_RECORDINGS_STOP: string = '/stop';

  private hostname: string;
  private port: number;
  private basicAuth: string;
  private Buffer = require('buffer/').Buffer;

  /**
   * @param urlOpenViduServer Public accessible IP where your instance of OpenVidu Server is up an running
   * @param secret Secret used on OpenVidu Server initialization
   */
  constructor(private urlOpenViduServer: string, secret: string) {
    this.setHostnameAndPort();
    this.basicAuth = this.getBasicAuth(secret);
  }

  /**
   * Creates an OpenVidu session. You can call [[Session.getSessionId]] in the resolved promise to retrieve the `sessionId`
   *
   * @returns A Promise that is resolved to the [[Session]] if success and rejected with an Error object if not.
   */
  public createSession(properties?: SessionProperties): Promise<Session> {
    return new Promise<Session>((resolve, reject) => {
      const session = new Session(this.hostname, this.port, this.basicAuth, properties);
      session.getSessionIdHttp()
        .then(sessionId => {
          resolve(session);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  public startRecording(sessionId: string): Promise<Recording>;
  public startRecording(sessionId: string, name: string): Promise<Recording>;
  public startRecording(sessionId: string, properties: RecordingProperties): Promise<Recording>;

  /**
   * Starts the recording of a [[Session]]
   *
   * @param sessionId The `sessionId` of the [[Session]] you want to start recording
   * @param name The name you want to give to the video file. You can access this same value in your clients on recording events (`recordingStarted`, `recordingStopped`)
   *
   * @returns A Promise that is resolved to the [[Recording]] if it successfully started (the recording can be stopped with guarantees) and rejected with an Error object if not. This Error object has as `message` property with the following values:
   * - `404`: no session exists for the passed `sessionId`
   * - `400`: the session has no connected participants
   * - `409`: the session is not configured for using [[MediaMode.ROUTED]] or it is already being recorded
   * - `501`: OpenVidu Server recording module is disabled (`openvidu.recording` property set to `false`)
   */
  public startRecording(sessionId: string, param2?: string | RecordingProperties): Promise<Recording> {
    return new Promise<Recording>((resolve, reject) => {

      let data;

      if (!!param2) {
        if (!(typeof param2 === 'string')) {
          const properties = <RecordingProperties>param2;
          data = JSON.stringify({
            session: sessionId,
            name: !!properties.name ? properties.name : '',
            recordingLayout: !!properties.recordingLayout ? properties.recordingLayout : '',
            customLayout: !!properties.customLayout ? properties.customLayout : ''
          });
        } else {
          data = JSON.stringify({
            session: sessionId,
            name: param2,
            recordingLayout: '',
            customLayout: ''
          });
        }
      } else {
        data = JSON.stringify({
          session: sessionId,
          name: '',
          recordingLayout: '',
          customLayout: ''
        });
      }

      axios.post(
        'https://' + this.hostname + ':' + this.port + OpenVidu.API_RECORDINGS + OpenVidu.API_RECORDINGS_START,
        data,
        {
          headers: {
            'Authorization': this.basicAuth,
            'Content-Type': 'application/json'
          }
        }
      )
        .then(res => {
          if (res.status === 200) {
            // SUCCESS response from openvidu-server (Recording in JSON format). Resolve new Recording
            resolve(new Recording(res.data));
          } else {
            // ERROR response from openvidu-server. Resolve HTTP status
            reject(new Error(res.status.toString()));
          }
        }).catch(error => {
          if (error.response) {
            // The request was made and the server responded with a status code (not 2xx)
            reject(new Error(error.response.status.toString()));
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.error(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
          }
        });
    });
  }

  /**
   * Stops the recording of a [[Session]]
   *
   * @param recordingId The `id` property of the [[Recording]] you want to stop
   *
   * @returns A Promise that is resolved to the [[Recording]] if it successfully stopped and rejected with an Error object if not. This Error object has as `message` property with the following values:
   * - `404`: no recording exists for the passed `recordingId`
   * - `406`: recording has `starting` status. Wait until `started` status before stopping the recording
   */
  public stopRecording(recordingId: string): Promise<Recording> {
    return new Promise<Recording>((resolve, reject) => {

      axios.post(
        'https://' + this.hostname + ':' + this.port + OpenVidu.API_RECORDINGS + OpenVidu.API_RECORDINGS_STOP + '/' + recordingId,
        undefined,
        {
          headers: {
            'Authorization': this.basicAuth,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
        .then(res => {
          if (res.status === 200) {
            // SUCCESS response from openvidu-server (Recording in JSON format). Resolve new Recording
            resolve(new Recording(res.data));
          } else {
            // ERROR response from openvidu-server. Resolve HTTP status
            reject(new Error(res.status.toString()));
          }
        }).catch(error => {
          if (error.response) {
            // The request was made and the server responded with a status code (not 2xx)
            reject(new Error(error.response.status.toString()));
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.error(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
          }
        });
    });
  }

  /**
   * Gets an existing [[Recording]]
   *
   * @param recordingId The `id` property of the [[Recording]] you want to retrieve
   *
   * @returns A Promise that is resolved to the [[Recording]] if it successfully stopped and rejected with an Error object if not. This Error object has as `message` property with the following values:
   * - `404`: no recording exists for the passed `recordingId`
   */
  public getRecording(recordingId: string): Promise<Recording> {
    return new Promise<Recording>((resolve, reject) => {

      axios.get(
        'https://' + this.hostname + ':' + this.port + OpenVidu.API_RECORDINGS + '/' + recordingId,
        {
          headers: {
            'Authorization': this.basicAuth,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
        .then(res => {
          if (res.status === 200) {
            // SUCCESS response from openvidu-server (Recording in JSON format). Resolve new Recording
            resolve(new Recording(res.data));
          } else {
            // ERROR response from openvidu-server. Resolve HTTP status
            reject(new Error(res.status.toString()));
          }
        }).catch(error => {
          if (error.response) {
            // The request was made and the server responded with a status code (not 2xx)
            reject(new Error(error.response.status.toString()));
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.error(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
          }
        });
    });
  }

  /**
   * Lists all existing recordings
   *
   * @returns A Promise that is resolved to an array with all existing recordings
   */
  public listRecordings(): Promise<Recording[]> {
    return new Promise<Recording[]>((resolve, reject) => {

      axios.get(
        'https://' + this.hostname + ':' + this.port + OpenVidu.API_RECORDINGS,
        {
          headers: {
            'Authorization': this.basicAuth,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
        .then(res => {
          if (res.status === 200) {
            // SUCCESS response from openvidu-server (JSON arrays of recordings in JSON format). Resolve list of new recordings
            const recordingArray: Recording[] = [];
            const responseItems = res.data.items;
            for (const item of responseItems) {
              recordingArray.push(new Recording(item));
            }
            resolve(recordingArray);
          } else {
            // ERROR response from openvidu-server. Resolve HTTP status
            reject(new Error(res.status.toString()));
          }
        }).catch(error => {
          if (error.response) {
            // The request was made and the server responded with a status code (not 2xx)
            reject(new Error(error.response.status.toString()));
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.error(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
          }
        });
    });
  }

  /**
   * Deletes a [[Recording]]. The recording must have status `stopped` or `available`
   *
   * @param recordingId
   *
   * @returns A Promise that is resolved if the Recording was successfully deleted and rejected with an Error object if not. This Error object has as `message` property with the following values:
   * - `404`: no recording exists for the passed `recordingId`
   * - `409`: the recording has `started` status. Stop it before deletion
   */
  public deleteRecording(recordingId: string): Promise<Error> {
    return new Promise<Error>((resolve, reject) => {

      axios.delete(
        'https://' + this.hostname + ':' + this.port + OpenVidu.API_RECORDINGS + '/' + recordingId,
        {
          headers: {
            'Authorization': this.basicAuth,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
        .then(res => {
          if (res.status === 204) {
            // SUCCESS response from openvidu-server. Resolve undefined
            resolve(undefined);
          } else {
            // ERROR response from openvidu-server. Resolve HTTP status
            reject(new Error(res.status.toString()));
          }
        }).catch(error => {
          if (error.response) {
            // The request was made and the server responded with a status code (not 2xx)
            reject(new Error(error.response.status.toString()));
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.error(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error', error.message);
          }
        });
    });
  }

  private getBasicAuth(secret: string): string {
    return 'Basic ' + this.Buffer('OPENVIDUAPP:' + secret).toString('base64');
  }

  private setHostnameAndPort(): void {
    const urlSplitted = this.urlOpenViduServer.split(':');
    if (urlSplitted.length === 3) { // URL has format: http:// + hostname + :port
      this.hostname = this.urlOpenViduServer.split(':')[1].replace(/\//g, '');
      this.port = parseInt(this.urlOpenViduServer.split(':')[2].replace(/\//g, ''));
    } else if (urlSplitted.length === 2) { // URL has format: hostname + :port
      this.hostname = this.urlOpenViduServer.split(':')[0].replace(/\//g, '');
      this.port = parseInt(this.urlOpenViduServer.split(':')[1].replace(/\//g, ''));
    } else {
      console.error("URL format incorrect: it must contain hostname and port (current value: '" + this.urlOpenViduServer + "')");
    }
  }

}