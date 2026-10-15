'use client'

import { useRef, useEffect, useState } from "react";

export default function Home() {

  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null)

  useEffect(()=> {
    //Keep track of stream instance for component cleanup
    let localStream: MediaStream | null = null;

    async function startCamera() {
      try{
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        } 

      } catch (err) {
        
        console.error( "could not access media devices", err)
        setError("could not access the camera, check device permissions")
      }
    }

    startCamera();

    return () => {
      if (localStream){
        localStream.getTracks().forEach((track)=> track.stop())
      }


    } 

  }, [] )

  return (

    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxWidth: "500px", borderRadius: "8px" }}
      />
      {error && <p> {error} </p>}
    </div>
    
  );
}
