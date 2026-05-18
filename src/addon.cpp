#include <napi.h>
#include <webview.h>

#include <memory>
#include <string>
#include <unordered_map>
#include <utility>

#ifdef _WIN32
#include <windows.h>
#endif

namespace {

constexpr webview_hint_t fixedWindowHint = WEBVIEW_HINT_FIXED;
constexpr webview_hint_t resizableWindowHint = WEBVIEW_HINT_NONE;
constexpr int bindingSuccessStatus = 0;
constexpr int bindingFailureStatus = 1;

#ifdef _WIN32
constexpr LONG_PTR framelessWindowStyleMask = WS_CAPTION | WS_THICKFRAME;
constexpr LONG_PTR framelessWindowStyleAdditions = WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU;
constexpr UINT windowFrameRefreshFlags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE;
#endif

class NativeWindow;

struct BindingContext {
  NativeWindow *window;
  std::string name;
  Napi::FunctionReference callback;
};

class NativeWindow final : public Napi::ObjectWrap<NativeWindow> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function constructor = DefineClass(
        env, "NativeWindow",
        {
            InstanceMethod<&NativeWindow::SetTitle>("setTitle"),
            InstanceMethod<&NativeWindow::LoadURL>("loadURL"),
            InstanceMethod<&NativeWindow::LoadHTML>("loadHTML"),
            InstanceMethod<&NativeWindow::ExecuteJavaScript>("executeJavaScript"),
            InstanceMethod<&NativeWindow::Bind>("bind"),
            InstanceMethod<&NativeWindow::Unbind>("unbind"),
            InstanceMethod<&NativeWindow::RunLoop>("runLoop"),
            InstanceMethod<&NativeWindow::Close>("close"),
            InstanceMethod<&NativeWindow::Destroy>("destroy"),
            InstanceMethod<&NativeWindow::Minimize>("minimize"),
            InstanceMethod<&NativeWindow::Maximize>("maximize"),
            InstanceMethod<&NativeWindow::Restore>("restore"),
            InstanceMethod<&NativeWindow::ToggleMaximize>("toggleMaximize"),
            InstanceMethod<&NativeWindow::IsMaximized>("isMaximized"),
            InstanceMethod<&NativeWindow::BeginDrag>("beginDrag"),
        });

    auto *constructorReference = new Napi::FunctionReference();
    *constructorReference = Napi::Persistent(constructor);
    env.SetInstanceData<Napi::FunctionReference>(constructorReference);
    exports.Set("NativeWindow", constructor);
    exports.Set("createWindow", Napi::Function::New(env, CreateNativeWindow));
    exports.Set("navigate", Napi::Function::New(env, NavigateDefaultWindow));
    exports.Set("runLoop", Napi::Function::New(env, RunDefaultWindow));
    return exports;
  }

  explicit NativeWindow(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<NativeWindow>(info), env_(info.Env()) {
    if (info.Length() != 1 || !info[0].IsObject()) {
      ThrowTypeError(env_, "NativeWindow options must be an object");
      return;
    }

    Napi::Object options = info[0].As<Napi::Object>();
    std::string title = ReadStringOption(options, "title", "NanoTron");
    int width = ReadIntegerOption(options, "width", 800);
    int height = ReadIntegerOption(options, "height", 600);
    bool resizable = ReadBooleanOption(options, "resizable", true);
    bool debug = ReadBooleanOption(options, "debug", false);
    bool frameless = ReadBooleanOption(options, "frameless", false);

    webview_ = webview_create(debug ? 1 : 0, nullptr);

    if (!webview_) {
      ThrowError(env_, "Failed to create webview window");
      return;
    }

    CheckWebviewResult(env_, webview_set_title(webview_, title.c_str()), "Failed to set window title");
    CheckWebviewResult(env_, webview_set_size(webview_, width, height, resizable ? resizableWindowHint : fixedWindowHint), "Failed to set window size");

    if (frameless) {
      ApplyFramelessWindowStyle(env_);
    }
  }

  ~NativeWindow() override {
    ReleaseNativeWindow();
  }

private:
  static Napi::Value CreateNativeWindow(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    auto *constructorReference = env.GetInstanceData<Napi::FunctionReference>();

    if (!constructorReference) {
      ThrowError(env, "NativeWindow constructor is unavailable");
      return env.Null();
    }

    Napi::Object options = Napi::Object::New(env);
    options.Set("title", info.Length() > 0 ? info[0] : Napi::String::New(env, "NanoTron"));
    options.Set("width", info.Length() > 1 ? info[1] : Napi::Number::New(env, 800));
    options.Set("height", info.Length() > 2 ? info[2] : Napi::Number::New(env, 600));
    options.Set("resizable", info.Length() > 3 ? info[3] : Napi::Boolean::New(env, true));
    return constructorReference->New({options});
  }

  static Napi::Value NavigateDefaultWindow(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (!defaultWindow_) {
      ThrowError(env, "Default native window has not been created");
      return env.Undefined();
    }

    return defaultWindow_->LoadURL(info);
  }

  static Napi::Value RunDefaultWindow(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (!defaultWindow_) {
      ThrowError(env, "Default native window has not been created");
      return env.Undefined();
    }

    return defaultWindow_->RunLoop(info);
  }

  Napi::Value SetTitle(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
    std::string title = ReadRequiredString(info, 0, "title must be a string");
    CheckWebviewResult(info.Env(), webview_set_title(webview_, title.c_str()), "Failed to set window title");
    return info.This();
  }

  Napi::Value LoadURL(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
    std::string url = ReadRequiredString(info, 0, "url must be a string");
    CheckWebviewResult(info.Env(), webview_navigate(webview_, url.c_str()), "Failed to navigate window");
    return info.This();
  }

  Napi::Value LoadHTML(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
    std::string html = ReadRequiredString(info, 0, "html must be a string");
    CheckWebviewResult(info.Env(), webview_set_html(webview_, html.c_str()), "Failed to load HTML");
    return info.This();
  }

  Napi::Value ExecuteJavaScript(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
    std::string code = ReadRequiredString(info, 0, "code must be a string");
    CheckWebviewResult(info.Env(), webview_eval(webview_, code.c_str()), "Failed to execute JavaScript");
    return info.This();
  }

  Napi::Value Bind(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
    std::string name = ReadRequiredString(info, 0, "binding name must be a string");

    if (info.Length() < 2 || !info[1].IsFunction()) {
      ThrowTypeError(info.Env(), "binding callback must be a function");
      return info.This();
    }

    auto bindingContext = std::make_unique<BindingContext>();
    bindingContext->window = this;
    bindingContext->name = name;
    bindingContext->callback = Napi::Persistent(info[1].As<Napi::Function>());

    BindingContext *bindingContextPointer = bindingContext.get();
    CheckWebviewResult(info.Env(), webview_bind(webview_, name.c_str(), HandleBinding, bindingContextPointer), "Failed to bind function");
    bindings_[name] = std::move(bindingContext);
    return info.This();
  }

  Napi::Value Unbind(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
    std::string name = ReadRequiredString(info, 0, "binding name must be a string");
    CheckWebviewResult(info.Env(), webview_unbind(webview_, name.c_str()), "Failed to unbind function");
    bindings_.erase(name);
    return info.This();
  }

  Napi::Value RunLoop(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
    defaultWindow_ = this;
    CheckWebviewResult(info.Env(), webview_run(webview_), "Window loop failed");
    ReleaseNativeWindow();
    return info.This();
  }

  Napi::Value Destroy(const Napi::CallbackInfo &info) {
    if (webview_) {
      webview_terminate(webview_);
      ReleaseNativeWindow();
    }

    return info.This();
  }

  Napi::Value Close(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
    CheckWebviewResult(info.Env(), webview_terminate(webview_), "Failed to close window");
    return info.This();
  }

  Napi::Value Minimize(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
#ifdef _WIN32
    ShowWindow(GetWindowHandle(info.Env()), SW_MINIMIZE);
    return info.This();
#else
    ThrowError(info.Env(), "Window minimize is currently implemented only on Windows");
    return info.This();
#endif
  }

  Napi::Value Maximize(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
#ifdef _WIN32
    ShowWindow(GetWindowHandle(info.Env()), SW_MAXIMIZE);
    return info.This();
#else
    ThrowError(info.Env(), "Window maximize is currently implemented only on Windows");
    return info.This();
#endif
  }

  Napi::Value Restore(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
#ifdef _WIN32
    ShowWindow(GetWindowHandle(info.Env()), SW_RESTORE);
    return info.This();
#else
    ThrowError(info.Env(), "Window restore is currently implemented only on Windows");
    return info.This();
#endif
  }

  Napi::Value ToggleMaximize(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
#ifdef _WIN32
    HWND windowHandle = GetWindowHandle(info.Env());
    ShowWindow(windowHandle, IsZoomed(windowHandle) ? SW_RESTORE : SW_MAXIMIZE);
    return Napi::Boolean::New(info.Env(), IsZoomed(windowHandle));
#else
    ThrowError(info.Env(), "Window maximize toggle is currently implemented only on Windows");
    return Napi::Boolean::New(info.Env(), false);
#endif
  }

  Napi::Value IsMaximized(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
#ifdef _WIN32
    return Napi::Boolean::New(info.Env(), IsZoomed(GetWindowHandle(info.Env())) != 0);
#else
    return Napi::Boolean::New(info.Env(), false);
#endif
  }

  Napi::Value BeginDrag(const Napi::CallbackInfo &info) {
    EnsureAlive(info.Env());
#ifdef _WIN32
    HWND windowHandle = GetWindowHandle(info.Env());
    ReleaseCapture();
    SendMessage(windowHandle, WM_NCLBUTTONDOWN, HTCAPTION, 0);
    return info.This();
#else
    ThrowError(info.Env(), "Window drag is currently implemented only on Windows");
    return info.This();
#endif
  }

  static void HandleBinding(const char *sequence, const char *request, void *argument) {
    auto *bindingContext = static_cast<BindingContext *>(argument);

    if (!bindingContext || !bindingContext->window) {
      return;
    }

    bindingContext->window->ResolveBinding(bindingContext, sequence, request);
  }

  void ResolveBinding(BindingContext *bindingContext, const char *sequence, const char *request) {
    if (!webview_ || !sequence || !request) {
      return;
    }

    Napi::HandleScope scope(env_);
    std::string serializedResult;
    int status = bindingSuccessStatus;

    try {
      Napi::Value result = bindingContext->callback.Call({Napi::String::New(env_, request)});
      serializedResult = SerializeJavaScriptValue(result);
    } catch (const Napi::Error &error) {
      status = bindingFailureStatus;
      serializedResult = SerializeError(error.Message());
    } catch (const std::exception &error) {
      status = bindingFailureStatus;
      serializedResult = SerializeError(error.what());
    } catch (...) {
      status = bindingFailureStatus;
      serializedResult = SerializeError("Binding failed");
    }

    webview_return(webview_, sequence, status, serializedResult.c_str());
  }

  std::string SerializeJavaScriptValue(const Napi::Value &value) {
    if (value.IsString()) {
      return value.As<Napi::String>().Utf8Value();
    }

    Napi::Object json = env_.Global().Get("JSON").As<Napi::Object>();
    Napi::Function stringify = json.Get("stringify").As<Napi::Function>();
    Napi::Value serializedValue = stringify.Call(json, {value});

    if (serializedValue.IsUndefined()) {
      return "null";
    }

    return serializedValue.As<Napi::String>().Utf8Value();
  }

  std::string SerializeError(const std::string &message) {
    Napi::Object json = env_.Global().Get("JSON").As<Napi::Object>();
    Napi::Function stringify = json.Get("stringify").As<Napi::Function>();
    Napi::Object error = Napi::Object::New(env_);
    error.Set("message", message);
    return stringify.Call(json, {error}).As<Napi::String>().Utf8Value();
  }

  void EnsureAlive(Napi::Env env) const {
    if (!webview_) {
      ThrowError(env, "Window has already been destroyed");
    }
  }

#ifdef _WIN32
  HWND GetWindowHandle(Napi::Env env) const {
    HWND windowHandle = static_cast<HWND>(webview_get_window(webview_));

    if (!windowHandle) {
      ThrowError(env, "Native window handle is unavailable");
    }

    return windowHandle;
  }

  void ApplyFramelessWindowStyle(Napi::Env env) {
    HWND windowHandle = GetWindowHandle(env);
    LONG_PTR windowStyle = GetWindowLongPtr(windowHandle, GWL_STYLE);
    windowStyle &= ~framelessWindowStyleMask;
    windowStyle |= framelessWindowStyleAdditions;
    SetWindowLongPtr(windowHandle, GWL_STYLE, windowStyle);
    SetWindowPos(windowHandle, nullptr, 0, 0, 0, 0, windowFrameRefreshFlags);
  }
#else
  void ApplyFramelessWindowStyle(Napi::Env env) {
    ThrowError(env, "Frameless windows are currently implemented only on Windows");
  }
#endif

  void ReleaseNativeWindow() {
    if (!webview_) {
      return;
    }

    if (defaultWindow_ == this) {
      defaultWindow_ = nullptr;
    }

    bindings_.clear();
    webview_destroy(webview_);
    webview_ = nullptr;
  }

  static std::string ReadRequiredString(const Napi::CallbackInfo &info, size_t index, const char *message) {
    if (info.Length() <= index || !info[index].IsString()) {
      ThrowTypeError(info.Env(), message);
      return {};
    }

    return info[index].As<Napi::String>().Utf8Value();
  }

  static std::string ReadStringOption(Napi::Object options, const char *name, const char *fallback) {
    Napi::Value value = options.Get(name);

    if (value.IsUndefined() || value.IsNull()) {
      return fallback;
    }

    if (!value.IsString()) {
      ThrowTypeError(options.Env(), "Window option must have the expected type");
      return fallback;
    }

    return value.As<Napi::String>().Utf8Value();
  }

  static int ReadIntegerOption(Napi::Object options, const char *name, int fallback) {
    Napi::Value value = options.Get(name);

    if (value.IsUndefined() || value.IsNull()) {
      return fallback;
    }

    if (!value.IsNumber()) {
      ThrowTypeError(options.Env(), "Window option must have the expected type");
      return fallback;
    }

    return value.As<Napi::Number>().Int32Value();
  }

  static bool ReadBooleanOption(Napi::Object options, const char *name, bool fallback) {
    Napi::Value value = options.Get(name);

    if (value.IsUndefined() || value.IsNull()) {
      return fallback;
    }

    if (!value.IsBoolean()) {
      ThrowTypeError(options.Env(), "Window option must have the expected type");
      return fallback;
    }

    return value.As<Napi::Boolean>().Value();
  }

  static void CheckWebviewResult(Napi::Env env, webview_error_t result, const char *message) {
    if (result != WEBVIEW_ERROR_OK) {
      ThrowError(env, message);
    }
  }

  static void ThrowError(Napi::Env env, const char *message) {
    Napi::Error::New(env, message).ThrowAsJavaScriptException();
  }

  static void ThrowTypeError(Napi::Env env, const char *message) {
    Napi::TypeError::New(env, message).ThrowAsJavaScriptException();
  }

  Napi::Env env_;
  webview_t webview_{nullptr};
  std::unordered_map<std::string, std::unique_ptr<BindingContext>> bindings_;
  static NativeWindow *defaultWindow_;
};

NativeWindow *NativeWindow::defaultWindow_ = nullptr;

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return NativeWindow::Init(env, exports);
}

} 

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
