import { Route, Routes } from "react-router-dom";
import { Home, AudioConversation, TextConversation } from "./pages";

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/audio-conversation" element={<AudioConversation />} />
        <Route path="/text-conversation" element={<TextConversation />} />
      </Routes>
    </>
  );
};

export default App;
