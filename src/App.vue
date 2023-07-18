<template>
  <div>
    <input type="file" accept="audio/mpeg" @change="handleFileSelect">
    <audio ref="audioPlayer" @timeupdate="updateLyricsDisplay"></audio>
    <button @click="play">播放</button>
    <button @click="pause">暂停</button>
    <div>{{ lyrics }}</div>
  </div>
</template>

<script>

export default {
  data() {
    return {
      lyricsUrl: '', // 存储生成的歌词文件的 URL
      lyrics: '', // 存储歌词内容
    };
  },
  methods: {
    handleFileSelect(event) {
      const file = event.target.files[0];
      const fileUrl = URL.createObjectURL(file);
      this.$refs.audioPlayer.src = fileUrl; 

      // 调用 OpenAI 语音接口，生成歌词文件的 URL 或内容，并将其设置给 lyricsUrl 变量
      this.generateLyrics(file)
    },
    generateLyrics(file) {
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

      const apiKey = ''
      const language = 'en'
      const response_format = 'srt'
      const response = transcribe(apiKey, file, language, response_format)

      response.then(transcription => {
          if (response_format === 'verbose_json') {
              //setTranscribedSegments(transcription.segments)
              this.lyrics = transcription
          } else {
              //setTranscribedPlainText(transcription)
              this.lyrics = transcription
          }

          // Allow multiple uploads without refreshing the page
          fileInput.value = null
      })
      
    },
    play() {
      this.$refs.audioPlayer.play();
    },
    pause() {
      this.$refs.audioPlayer.pause();
    },
    updateLyricsDisplay() {
      // 根据音频的播放时间，更新当前应该显示的歌词部分
      // ...
    },
  },
};
</script>
