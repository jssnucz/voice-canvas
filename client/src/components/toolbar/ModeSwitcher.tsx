export function ModeSwitcher() {
  return (
    <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1 text-sm">
      <button className="px-3 py-1 bg-blue-600 rounded-md">流程图</button>
      <button className="px-3 py-1 rounded-md hover:bg-gray-600">架构图</button>
    </div>
  );
}
