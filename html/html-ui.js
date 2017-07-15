(function setupForHTMLPage() {
    let UserRegistry = lively.user.UserRegistry, ClientUser = lively.user.ClientUser, authServerURL = "https://auth.lively-next.org", overlay, resolve, reject, loginWidget = document.querySelector(".html-login-widget"), registerWidget = document.querySelector(".html-register-widget");
    lively.user.html = { openUserUI: openUserUI };
    return;
    function openUserUI() {
      setupLoginWidget();
      setupRegisterWidget();
      overlay = openOverlay(loginWidget);
      loginWidget.querySelector(".user-name-input").focus();
      return new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
    }
    function resolveWithUser(user) {
      console.log(`Logged in as ${ user }`);
      overlay.remove();
      resolve(user);
    }
    async function tryRegister() {
      let userNameInput = registerWidget.querySelector(".user-name-input"), passwordInput = registerWidget.querySelector(".password-input"), passwordInput2 = registerWidget.querySelector(".password-input-2"), emailInput = registerWidget.querySelector(".email-input"), username = userNameInput.value, email = emailInput.value, password = passwordInput.value, password2 = passwordInput2.value;
      if (!username)
        return;
      if (!username || !password || !password2)
        return window.confirm("Please check your input");
      if (password !== password2)
        return window.confirm("Passwords do not match!");
      let user = ClientUser.named(username, authServerURL);
      if (email)
        user.email = email;
      let error;
      try {
        await UserRegistry.current.register(user, password);
      } catch (err) {
        error = err;
      }
      if (error)
        return window.confirm("Failed to register: " + error);
      resolveWithUser(user);
    }
    async function tryLogin() {
      let userNameInput = loginWidget.querySelector(".user-name-input"), passwordInput = loginWidget.querySelector(".password-input"), username = userNameInput.value, password = passwordInput.value;
      if (!username)
        return;
      let user = ClientUser.named(username, authServerURL), error;
      try {
        await UserRegistry.current.login(user, password);
      } catch (err) {
        error = err.message;
      }
      if (error) {
        window.confirm(error);
        return;
      }
      resolveWithUser(user);
    }
    function switchToRegisterWidget() {
      loginWidget.style.display = "none";
      loginWidget.parentNode.appendChild(registerWidget);
      registerWidget.style.display = "";
      registerWidget.querySelector(".user-name-input").focus();
    }
    function switchToLoginWidget() {
      registerWidget.style.display = "none";
      registerWidget.parentNode.appendChild(loginWidget);
      loginWidget.style.display = "";
      loginWidget.querySelector(".user-name-input").focus();
    }
    async function continueAsGuest() {
      let reg = UserRegistry.current, stored = reg.loadUserFromLocalStorage(authServerURL), user = stored.isGuestUser ? stored : await reg.login(ClientUser.guest);
      resolveWithUser(user);
    }
    function setupRegisterWidget() {
      let registerButton = registerWidget.querySelector(".register-button"), cancelButton = registerWidget.querySelector(".cancel-button");
      cancelButton.onclick = () => switchToLoginWidget();
      registerButton.onclick = () => tryRegister();
      registerWidget.onkeydown = evt => {
        if (evt.keyCode === 13)
          tryRegister();
        else if (evt.keyCode === 27)
          switchToLoginWidget();
      };
    }
    function setupLoginWidget() {
      let loginButton = loginWidget.querySelector(".login-button"), registerButton = loginWidget.querySelector(".register-button"), guestButton = loginWidget.querySelector(".guest-button");
      registerButton.onclick = () => switchToRegisterWidget();
      guestButton.onclick = () => continueAsGuest();
      loginButton.onclick = () => tryLogin();
      loginWidget.onkeydown = evt => {
        if (evt.keyCode === 13)
          tryLogin();
        else if (evt.keyCode === 27) {
        }
      };
    }
    function openOverlay(targetElement, options = {}) {
      options = options || {};
      let el = document.createElement("div");
      el.style.cssText = "background-color: rgba(0,0,0,0.7);; width: 100%; height: 100%; position: absolute; top: 0; display: flex; flex-direction: column; justify-content: center; align-items: center;";
      document.body.appendChild(el);
      var bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      if (options.removeOnClick) {
        el.addEventListener("click", () => overlay.remove());
        el.addEventListener("touchend", () => overlay.remove());
      }
      el.appendChild(targetElement);
      if (targetElement.style.display === "none")
        targetElement.style.display = "";
      var overlay = {
        el: el,
        remove: () => {
          document.body.style.overflow = bodyOverflow;
          el.parentNode.removeChild(el);
          typeof options.onRemove === "function" && options.onRemove();
        }
      };
      return overlay;
    }
  })();