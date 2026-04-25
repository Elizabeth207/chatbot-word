import { FileIcon, XIcon } from "../../../shared/ui/icons";

interface ChatInputFileBarProps {
  file: File | null;
  setFile: (f: File | null) => void;
  setImagePreview: (p: string | null) => void;
  uploading: boolean;
  onUpload: () => void;
  onRemoveFile: () => void;
}

export function ChatInputFileBar({
  file,
  setFile,
  setImagePreview,
  uploading,
  onUpload,
  onRemoveFile,
}: ChatInputFileBarProps) {
  return (
    <div className="file-area">
      <input
        id="file-input"
        type="file"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) {
            setFile(selectedFile);
            if (selectedFile.type.startsWith("image/")) {
              const reader = new FileReader();
              reader.onload = (event) => {
                setImagePreview(event.target?.result as string);
              };
              reader.readAsDataURL(selectedFile);
            } else {
              setImagePreview(null);
            }
          }
        }}
        className="file-input"
      />
      <label htmlFor="file-input" className="btn-file" title="Seleccionar archivo">
        <FileIcon />
        <span>Archivo</span>
      </label>
      {file && (
        <div className="file-selected">
          <span className="file-name">{file.name}</span>
          <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
          <button onClick={onRemoveFile} className="btn-remove-file" title="Quitar archivo">
            <XIcon />
          </button>
        </div>
      )}
      <button onClick={onUpload} disabled={uploading || !file} className="btn-upload">
        {uploading ? "Subiendo..." : "Subir"}
      </button>
    </div>
  );
}
