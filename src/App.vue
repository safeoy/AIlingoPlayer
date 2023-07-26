<template>
  <div class="navbar bg-base-100">
    <div class="navbar-start">
      <div class="dropdown">
        <label tabindex="0" class="btn btn-ghost lg:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" /></svg>
        </label>
      </div>
      <a class="btn btn-ghost normal-case text-xl">AIlingoPlayer</a>
    </div>
    <div class="navbar-center hidden lg:flex">
      
    </div>
    <div class="navbar-end">
      <button class="btn" onclick="my_modal_1.showModal()">Setting</button>
      <dialog id="my_modal_1" class="modal">
        <form method="dialog" class="modal-box">
          <h3 class="font-bold text-lg">OpenAI Key</h3>
          <input type="text" v-model="apiKey" placeholder="sk-xxxx" class="input input-bordered w-full max-w-xs" />
          <div class="modal-action">
            <!-- if there is a button in form, it will close the modal -->
            <button class="btn">Save</button>
          </div>
        </form>
      </dialog>
    </div>
  </div>
  
  <div>
    <audio id="player"  playsinline controls ></audio>
  </div>
  
  <!-- <div class="form-control w-full max-w-xs">
    <label class="label">
      <span class="label-text">OpenAI Key</span>
    </label>
    <input type="text" v-model="apiKey" placeholder="sk-xxxx" class="input input-bordered w-full max-w-xs" />
  </div> -->
  <div>
    <input type="file" accept="audio/mp3" class="file-input w-full max-w-xs" @change="handleFileSelect">
  </div>
  <div>
    <button class="btn" @click="generateLyrics">生成字幕</button>
  </div>
  <div className="card w-96 bg-base-100 shadow-xl">
  <div className="card-body">
    <div className="card-actions justify-end">
      <button className="btn btn-square btn-sm">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
    <p>{{ currentSubtitle }}</p>
  </div>
</div>
</template>

<script>

import Plyr from 'plyr';
import { WebVTT } from 'vtt.js';

const player = new Plyr('#player', {captions: {active: true}});

export default {
  mounted() {
    this.player = new Plyr('#player', {
      /* options */
    });
    //this.parseSubtitles();
  },
  beforeDestroy() {
    // 销毁播放器实例
    this.player.destroy();
  },
  data() {
    return {
      lyrics: 'loading', // 存储歌词内容
      lyricsUrl:'',
      file:'',
      fileUrl:'',
      apiKey: '',
      cues: [],
      currentSubtitle: 'loading',
    };
  },
  watch: {
    apiKey(newValue) {
      localStorage.setItem('apiKey', newValue);
    },
  },
  created() {
    this.apiKey = localStorage.getItem('apiKey') || '';
  },
  methods: {
    parseSubtitles() {
      let parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
      parser.oncue = cue => {
        this.cues.push(cue);
      };
      parser.parse(this.lyrics);
      parser.flush();

      this.player.on('timeupdate', (event) => {
        this.updateSubtitle();
      });
    },
    updateSubtitle() {
      console.log("updateSubtitle:"+this.player.currentTime);
      let currentTime = this.player.currentTime;
      let currentCue = this.cues.find(cue => currentTime >= cue.startTime && currentTime <= cue.endTime);
      console.log("currentCue:"+ currentCue.startTime);
      console.log("currentCue:"+ currentCue.endTime);
      console.log("currentCue:"+ currentCue.text);
      this.currentSubtitle = currentCue ? currentCue.text : '';
    },
    handleFileSelect(event) {
      this.file = event.target.files[0];
      this.fileUrl = URL.createObjectURL(this.file);
      this.player.source = {
          type: 'audio',
          title: 'Example title',
          sources: [
            {
              src: this.fileUrl,
              type: 'audio/mp3',
            }
          ],
        };
    },
    generateLyrics() {
      const url = 'https://api.openai.com/v1/audio/transcriptions'

      const transcribe = (apiKey, file, language, response_format) => {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('model', 'whisper-1')
          formData.append('response_format', response_format || 'verbose_json')
          if (language) {
              formData.append('language', language)
          }

          const headers = new Headers()
          headers.append('Authorization', `Bearer ${apiKey}`)

          return fetch(url, {
              method: 'POST',
              body: formData,
              headers: headers
          }).then(response => {
              console.log(response)
              // Automatically handle response format
              if (response_format === 'json' || response_format === 'verbose_json') {
                  return response.json()
              } else {
                  return response.text()
              }
          }).catch(error => console.error(error))
      }

      const language = 'en'
      const response_format = 'vtt'
      const response = transcribe(this.apiKey, this.file, language, response_format)

      response.then(transcription => {
          this.lyrics = transcription
          let blob = new Blob([this.lyrics], { type: 'text/plain' });
          const lyricsUrl = URL.createObjectURL(blob);
          this.parseSubtitles();
      });
    }
  },
};
</script>

<style>
@import "plyr/dist/plyr.css";
</style>