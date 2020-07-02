import * as fsScript from 'flex-dev-utils/dist/fs';
import { Request, Response } from 'express-serve-static-core';
import { Plugin } from '../../devServer/pluginServer';

import * as pluginServerScript from '../../devServer/pluginServer';

jest.mock('flex-dev-utils/dist/logger');

describe('pluginServer', () => {
  const paths = {
    app: {
      name: 'default-plugin',
      pluginsServicePath: 'pluginsService.js',
    },
  };

  const pkg: fsScript.PackageJson = {
    name: 'default-plugin',
    version: '1.2.3',
    dependencies: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // @ts-ignore
    jest.spyOn(fsScript, 'getPaths').mockReturnValue(paths);
  });

  describe('_rebasePlugins', () => {
    it('should return empty array of localPlugin is empty', () => {
      const remotePluginOne = { name: 'plugin-remote-1' } as Plugin;
      const remotePluginTwo = { name: 'plugin-remote-2' } as Plugin;

      const _getLocalPlugins = jest
        .spyOn(pluginServerScript, '_getLocalPlugins')
        .mockReturnValue([]);

      const plugins = pluginServerScript._rebasePlugins([remotePluginOne, remotePluginTwo]);

      expect(plugins).toHaveLength(0);
      expect(_getLocalPlugins).toHaveBeenCalledTimes(1);
    });

    it('should return only local plugins', () => {
      const defaultPlugin = { name: 'default-plugin' } as Plugin;
      const remotePluginOne = { name: 'plugin-remote-1' } as Plugin;
      const remotePluginTwo = { name: 'plugin-remote-2' } as Plugin;

      jest
        .spyOn(pluginServerScript, '_getLocalPlugins')
        .mockReturnValue([defaultPlugin]);

      jest
        .spyOn(fsScript, 'readPackageJson')
        .mockReturnValue(pkg);

      const plugins = pluginServerScript._rebasePlugins([remotePluginOne, remotePluginTwo]);

      expect(plugins).toHaveLength(1);
      expect(plugins[0]).toBe(defaultPlugin);
    });

    it('should return only default if remaining are disabled', () => {
      const defaultPlugin = { name: 'default-plugin' } as Plugin;
      const pluginOne = { name: 'plugin-remote-1' } as Plugin;
      const pluginTwo = { name: 'plugin-remote-2', enabled: false } as Plugin;
      const pluginThree = { name: 'plugin-remote-3', enabled: false, remote: true } as Plugin;
      const pluginFour = { name: 'plugin-remote-3', enabled: false, src: 'url' } as Plugin;

      jest
        .spyOn(pluginServerScript, '_getLocalPlugins')
        .mockReturnValue([ defaultPlugin, pluginOne, pluginTwo, pluginThree, pluginFour ]);

      const plugins = pluginServerScript._rebasePlugins([pluginOne, pluginTwo]);

      expect(plugins).toHaveLength(1);
      expect(plugins[0]).toBe(defaultPlugin);
    });

    it('should not return other plugins if schema is incorrect', () => {
      const defaultPlugin = { name: 'default-plugin' } as Plugin;
      const pluginOne = { name: 'plugin-remote-1', enabled: true } as Plugin;

      jest
        .spyOn(pluginServerScript, '_getLocalPlugins')
        .mockReturnValue([ defaultPlugin, pluginOne ]);

      const plugins = pluginServerScript._rebasePlugins([pluginOne]);

      expect(plugins).toHaveLength(1);
      expect(plugins[0]).toBe(defaultPlugin);
    });

    it('should return enabled plugin as local', () => {
      const defaultPlugin = { name: 'default-plugin' } as Plugin;
      const pluginOne = { name: 'plugin-remote-1', enabled: true, src: 'url' } as Plugin;
      const pluginTwo = { name: 'plugin-remote-2', enabled: false } as Plugin;

      jest
        .spyOn(pluginServerScript, '_getLocalPlugins')
        .mockReturnValue([ defaultPlugin, pluginOne, pluginTwo ]);

      const plugins = pluginServerScript._rebasePlugins([pluginOne, pluginTwo]);

      expect(plugins).toHaveLength(2);
      expect(plugins[0]).toBe(defaultPlugin);
      expect(plugins[1]).toBe(pluginOne);
    });

    it('should return remote plugin', () => {
      const defaultPlugin = { name: 'default-plugin' } as Plugin;
      const pluginOne = { name: 'plugin-remote-1', enabled: true, remote: true } as Plugin;
      jest
        .spyOn(pluginServerScript, '_getLocalPlugins')
        .mockReturnValue([ defaultPlugin, pluginOne ]);

      const plugins = pluginServerScript._rebasePlugins([pluginOne]);

      expect(plugins).toHaveLength(2);
      expect(plugins[0]).toBe(defaultPlugin);
      expect(plugins[1]).toBe(pluginOne);
    });
  });

  describe('default', () => {
    const options = { port: 9000 };
    const jweHeaders = { 'x-flex-jwe': 'jweToken' };
    const getReqResp = (method: string, headers: object) => {
      // @ts-ignore
      const resp = {
        writeHead: jest.fn(),
        end: jest.fn(),
      } as Response;
      const req = { method, headers } as Request;

      return { req, resp };
    };

    it('should return 200 for OPTIONS request', async () => {
      const { req, resp } = getReqResp('OPTIONS', {});
      const _getHeaders = jest
        .spyOn(pluginServerScript, '_getHeaders')
        .mockReturnValue({ header: 'true' } as any);

      await pluginServerScript.default(options)(req , resp);

      expect(_getHeaders).toHaveBeenCalledTimes(1);
      expect(_getHeaders).toHaveBeenCalledWith(options.port);
      expect(resp.writeHead).toHaveBeenCalledTimes(1);
      expect(resp.writeHead).toHaveBeenCalledWith(200, { header: 'true' });
      expect(resp.end).toHaveBeenCalledTimes(1);
    });

    it('should 404 for non GET requests', async () => {
      const { req, resp } = getReqResp('POST', {});
      jest
        .spyOn(pluginServerScript, '_getHeaders')
        .mockReturnValue({ header: 'true' } as any);

      await pluginServerScript.default(options)(req , resp);

      expect(resp.writeHead).toHaveBeenCalledTimes(1);
      expect(resp.writeHead).toHaveBeenCalledWith(404, { header: 'true' });
      expect(resp.end).toHaveBeenCalledTimes(1);
    });

    it('should 400 if no jwe token is provided', () => {
      const { req, resp } = getReqResp('GET', {});
      jest
        .spyOn(pluginServerScript, '_getHeaders')
        .mockReturnValue({ header: 'true' } as any);

      pluginServerScript.default(options)(req , resp);

      expect(resp.writeHead).toHaveBeenCalledTimes(1);
      expect(resp.writeHead).toHaveBeenCalledWith(400, { header: 'true' });
      expect(resp.end).toHaveBeenCalledTimes(1);
    });

    it('should getPlugins and rebase', async (done) => {
      const { req, resp } = getReqResp('GET', jweHeaders);

      jest
        .spyOn(pluginServerScript, '_getHeaders')
        .mockReturnValue({ header: 'true' } as any);
      const _getRemotePlugins = jest
        .spyOn(pluginServerScript, '_getRemotePlugins')
        .mockResolvedValue([{ name: 'plugin-2' }] as Plugin[]);
      const _rebasePlugins = jest
        .spyOn(pluginServerScript, '_rebasePlugins')
        .mockReturnValue([{name: 'plugin-1'}] as Plugin[]);

      await pluginServerScript.default(options)(req , resp);

      expect(resp.writeHead).toHaveBeenCalledTimes(1);
      expect(resp.writeHead).toHaveBeenCalledWith(200, { header: 'true' });
      expect(_getRemotePlugins).toHaveBeenCalledTimes(1);
      expect(_getRemotePlugins).toHaveBeenCalledWith('jweToken', undefined);
      expect(_rebasePlugins).toHaveBeenCalledTimes(1);
      expect(resp.end).toHaveBeenCalledTimes(1);
      expect(resp.end).toHaveBeenCalledWith('[{"name":"plugin-1"}]');

      done();
    });

    it.only('should fail', async (done) => {
      const { req, resp } = getReqResp('GET', jweHeaders);

      jest
        .spyOn(pluginServerScript, '_getHeaders')
        .mockReturnValue({ header: 'true' } as any);
      const _getRemotePlugins = jest
        .spyOn(pluginServerScript, '_getRemotePlugins')
        .mockRejectedValue('failed-message');
      const _rebasePlugins = jest
        .spyOn(pluginServerScript, '_rebasePlugins');

      await pluginServerScript.default(options)(req , resp);

      expect(resp.writeHead).toHaveBeenCalledTimes(1);
      expect(resp.writeHead).toHaveBeenCalledWith(500, { header: 'true' });
      expect(_getRemotePlugins).toHaveBeenCalledTimes(1);
      expect(_getRemotePlugins).toHaveBeenCalledWith('jweToken', undefined);
      expect(_rebasePlugins).not.toHaveBeenCalled();
      expect(resp.end).toHaveBeenCalledTimes(1);
      expect(resp.end).toHaveBeenCalledWith('failed-message');

      done();
    });
  });
});