import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon, Loader2, Video, Play, Pause, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ObjectDetector = () => {
  const [activeTab, setActiveTab] = useState('image');
  const [isLoading, setIsLoading] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [processedImage, setProcessedImage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [videoSrc, setVideoSrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const animationFrameId = useRef(null);
  const lastFrameTime = useRef(Date.now());

  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [videoSrc]);

  const handleImageUpload = async (event) => {
    const file = event instanceof File ? event : event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/detect', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setPredictions(data.detections);
      setProcessedImage(data.image);
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoUpload = (event) => {
    const file = event instanceof File ? event : event.target.files?.[0];
    if (!file) return;
    
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    
    setPredictions([]);
    setProcessedImage(null);
    setIsPlaying(false);
    
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.currentTime = 0;
      };
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        await handleImageUpload(file);
      } else if (file.type.startsWith('video/')) {
        handleVideoUpload(file);
      }
    }
  };

  const processVideoFrame = async () => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
      return;
    }
  
    const now = Date.now();
    const timeSinceLastFrame = now - lastFrameTime.current;
    if (timeSinceLastFrame < (1000 / 30)) {
      animationFrameId.current = requestAnimationFrame(processVideoFrame);
      return;
    }
    lastFrameTime.current = now;
  
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
      
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      const formData = new FormData();
      formData.append('file', blob);
  
      const response = await fetch('http://localhost:8000/detect-stream', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      setPredictions(data.detections);
      setProcessedImage(data.image);
      
      if (!videoRef.current?.paused) {
        animationFrameId.current = requestAnimationFrame(processVideoFrame);
      }
    } catch (error) {
      console.error('Error processing frame:', error);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  };

  const toggleVideoPlayback = async () => {
    if (!videoRef.current) return;
  
    try {
      if (videoRef.current.paused) {
        lastFrameTime.current = Date.now();
        await videoRef.current.play();
        setIsPlaying(true);
        processVideoFrame();
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
      }
    } catch (error) {
      console.error('Error toggling video playback:', error);
      setIsPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Drone Detection
          </h1>
          <p className="text-gray-600 text-lg">Powered by YOLOv8 Technology</p>
        </motion.div>

        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-gray-100/80 p-1">
                {['image', 'video'].map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="relative rounded-full min-h-[44px] data-[state=active]:bg-white data-[state=active]:shadow-lg"
                  >
                    <motion.div 
                      className="absolute inset-0 flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {tab === 'image' ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <Video className="w-5 h-5" />
                      )}
                      <span className="capitalize">{tab}</span>
                    </motion.div>
                  </TabsTrigger>
                ))}
              </TabsList>

              {['image', 'video'].map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`
                      relative rounded-2xl p-8 transition-all
                      ${dragActive 
                        ? 'bg-purple-100/50 border-2 border-dashed border-purple-400' 
                        : 'bg-gray-50/50 border-2 border-dashed border-gray-300'
                      }
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center gap-6">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 180 }}
                        transition={{ duration: 0.3 }}
                        className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center"
                      >
                        <Upload className="w-8 h-8 text-purple-600" />
                      </motion.div>
                      <div className="text-center space-y-2">
                        <p className="text-gray-600 text-lg">
                          Drag and drop your {tab} here, or
                        </p>
                        <button
                          onClick={() => tab === 'image' 
                            ? fileInputRef.current?.click() 
                            : videoInputRef.current?.click()
                          }
                          className="text-purple-600 hover:text-purple-700 font-semibold text-lg"
                        >
                          browse files
                        </button>
                      </div>
                    </div>
                    <input
                      ref={tab === 'image' ? fileInputRef : videoInputRef}
                      type="file"
                      accept={`${tab}/*`}
                      onChange={tab === 'image' ? handleImageUpload : handleVideoUpload}
                      className="hidden"
                    />
                  </motion.div>

                  {tab === 'video' && videoSrc && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="relative rounded-2xl overflow-hidden shadow-2xl"
                    >
                      <video
                        ref={videoRef}
                        className="w-full"
                        playsInline
                        style={{ maxHeight: '600px', objectFit: 'contain' }}
                      />
                      <motion.div 
                        className="absolute bottom-6 left-6"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Button
                          onClick={toggleVideoPlayback}
                          className="rounded-full px-6 py-4 bg-purple-600 hover:bg-purple-700"
                        >
                          {isPlaying ? (
                            <><Pause className="w-5 h-5 mr-2" /> Pause</>
                          ) : (
                            <><Play className="w-5 h-5 mr-2" /> Play</>
                          )}
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </TabsContent>
              ))}

              <div className="relative mt-8">
                <AnimatePresence>
                  {processedImage && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="rounded-2xl overflow-hidden shadow-2xl"
                    >
                      <img
                        src={processedImage}
                        alt="Processed"
                        className="w-full"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
                  >
                    <div className="flex flex-col items-center gap-4 text-white">
                      <Loader2 className="w-12 h-12 animate-spin" />
                      <span className="text-xl font-medium">Processing...</span>
                    </div>
                  </motion.div>
                )}
              </div>

              <AnimatePresence>
                {predictions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-6 h-6 text-purple-600" />
                      <h3 className="text-xl font-semibold text-gray-800">
                        Detection Results ({predictions.length})
                      </h3>
                    </div>
                    
                    <motion.div 
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                      layout
                    >
                      {predictions.map((pred, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          whileHover={{ scale: 1.05 }}
                          className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-purple-100"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-semibold text-gray-800">
                              {pred.class_name}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-green-600 font-medium">
                                {Math.round(pred.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ObjectDetector;