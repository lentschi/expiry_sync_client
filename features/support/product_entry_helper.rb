require 'rspec'
require 'calabash-android/operations'
require './features/support/memory_mixin'

module CucumberExpirySyncHelpers
  class ProductEntryHelper
    include RSpec::Matchers
    include MemoryMixin
    
    attr_accessor :world
    
    def initialize(world)
      @world = world
    end
    
    def webcam_show_img!(image_name)
      #@world.puts `features/support/device_dependent_scripts/start_showing_image #{image_name}`
      `features/support/device_dependent_scripts/start_showing_image #{image_name}`
    end
    
    def stop_webcam_emulation!()
      #@world.puts `features/support/device_dependent_scripts/stop_showing_image`
      `features/support/device_dependent_scripts/stop_showing_image`
    end
  end
end

World(CucumberExpirySyncHelpers)