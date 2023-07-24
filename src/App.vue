<template>
  <div>
    <audio id="player" playsinline controls ></audio>
    <input type="file" accept="audio/mp3" @change="handleFileSelect">
    OpenAI API key:
    <input type="text" v-model="apiKey" placeholder="sk-xxxx">
    <button @click="generateLyrics">生成字幕</button>
    <div>{{ lyrics }}</div>
  </div>
</template>

<script>

import Plyr from 'plyr';

const player = new Plyr('#player', {captions: {active: true}});

export default {
  mounted() {
    this.player = new Plyr('#player', {
      /* options */
    });
  },
  beforeDestroy() {
    // 销毁播放器实例
    this.player.destroy();
  },
  data() {
    return {
      lyrics: '', // 存储歌词内容
      lyricsUrl:'',
      file:'',
      fileUrl:'',
      apiKey: '',
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
      const response_format = 'srt'
      const response = transcribe(this.apiKey, this.file, language, response_format)

      response.then(transcription => {
          this.lyrics = transcription
          let blob = new Blob([this.lyrics], { type: 'text/plain' });
          const lyricsUrl = URL.createObjectURL(blob);
      });
    }
  },
};
</script>

<style>
@import "plyr/dist/plyr.css";
</style>